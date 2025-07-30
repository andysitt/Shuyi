import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  ToolRegistry,
  Config,
  ConfigParameters,
  ToolResult,
} from "@google/gemini-cli-core";
import { convertSchemaToFunctionDefinition } from "./utils";
import { Schema } from "@google/genai";
import { ChatCompletionTool } from "openai/resources/index.mjs";

export type ToolCallContent =
  | {
      type: "markdown";
      markdown: string;
    }
  | {
      type: "diff";
      newText: string;
      oldText: string | null;
      path: string;
    };

// LLM配置接口
export interface LLMConfig {
  provider: "openai" | "anthropic" | "custom";
  apiKey: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

// 代码分析请求
export interface CodeAnalysisRequest {
  code: string;
  filePath: string;
  language: string;
  analysisType:
    | "overview"
    | "complexity"
    | "security"
    | "documentation"
    | "optimization";
  context?: {
    projectStructure?: string;
    dependencies?: string[];
    entryPoints?: string[];
  };
}

// 分析结果
export interface CodeAnalysisResult {
  summary: string;
  keyInsights: string[];
  potentialIssues: string[];
  recommendations: string[];
  codeQuality: {
    score: number;
    metrics: Record<string, any>;
  };
  documentation?: string;
  examples?: string[];
}

// 项目分析请求
export interface ProjectAnalysisRequest {
  projectStructure: string;
  keyFiles: Array<{
    path: string;
    content: string;
    language: string;
  }>;
  dependencies: string[];
  entryPoints: string[];
  analysisGoal: string;
  repositoryPath: string;
}

function toToolCallContent(toolResult: ToolResult): ToolCallContent | null {
  if (toolResult.returnDisplay) {
    if (typeof toolResult.returnDisplay === "string") {
      return {
        type: "markdown",
        markdown: toolResult.returnDisplay,
      };
    } else {
      return {
        type: "diff",
        path: toolResult.returnDisplay.fileName,
        oldText: toolResult.returnDisplay.originalContent,
        newText: toolResult.returnDisplay.newContent,
      };
    }
  } else {
    return null;
  }
}

// LLM客户端
export class LLMClient {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;
  private geminiConfig: Config;

  constructor(config: LLMConfig, repositoryPath: string) {
    this.config = config;
    const params: ConfigParameters = {
      sessionId: Date.now().toString(),
      targetDir: repositoryPath,
      debugMode: false,
      cwd: repositoryPath,
      model: "test-model",
    };
    this.geminiConfig = new Config(params);

    if (config.provider === "openai" || config.provider === "custom") {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    } else if (config.provider === "anthropic") {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    }
  }

  // 分析单个文件
  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResult> {
    const prompt = this.buildCodeAnalysisPrompt(request);

    try {
      const response = await this.callLLM(prompt);
      return this.parseCodeAnalysisResponse(response);
    } catch (error) {
      throw new Error(
        `代码分析失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 分析单个文件（支持工具调用）
  async analyzeCodeWithTools(
    request: CodeAnalysisRequest
  ): Promise<CodeAnalysisResult> {
    const prompt = this.buildCodeAnalysisPrompt(request);

    try {
      const response = await this.callLLM(prompt);
      return this.parseCodeAnalysisResponse(response);
    } catch (error) {
      throw new Error(
        `代码分析失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 分析整个项目
  async analyzeProject(request: ProjectAnalysisRequest): Promise<{
    architecture: string;
    technologyStack: string[];
    keyFeatures: string[];
    potentialIssues: string[];
    recommendations: string[];
  }> {
    const prompt = this.buildProjectAnalysisPrompt(request);

    try {
      const response = await this.callLLM(prompt);
      return this.parseProjectAnalysisResponse(response);
    } catch (error) {
      throw new Error(
        `项目分析失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 生成文档
  async generateDocumentation(analysis: any): Promise<string> {
    const prompt = this.buildDocumentationPrompt(analysis);

    try {
      return await this.callLLM(prompt);
    } catch (error) {
      throw new Error(
        `文档生成失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 分析项目结构
  async analyzeProjectStructure(request: any): Promise<any> {
    const prompt = this.buildProjectStructurePrompt(request);

    try {
      const response = await this.callLLM(prompt);
      return this.parseProjectStructureResponse(response);
    } catch (error) {
      throw new Error(
        `项目结构分析失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // 调用LLM API，支持工具调用处理循环
  private async callLLM(prompt: string): Promise<string> {
    const pendingSend = new AbortController();
    if (
      (this.config.provider === "openai" ||
        this.config.provider === "custom") &&
      this.openai
    ) {
      await this.geminiConfig.initialize();
      const toolRegistry: ToolRegistry =
        await this.geminiConfig.getToolRegistry();
      type JSONSchema = {
        [key: string]: any;
      };
      const lowercaseType = (schema: Schema): JSONSchema => {
        const newSchema: JSONSchema = { ...schema };

        for (const key in newSchema) {
          if (!newSchema.hasOwnProperty(key)) continue;

          const value = newSchema[key];

          if (key === "type" && typeof value === "string") {
            newSchema[key] = value.toLowerCase();
          } else if (
            !Array.isArray(value) &&
            typeof value === "object" &&
            value !== null
          ) {
            newSchema[key] = lowercaseType(value);
          }
        }

        return newSchema;
      };

      const numericKeywords = new Set([
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
        "minProperties",
        "maxProperties",
        "multipleOf",
      ]);

      /**
       * 修复 JSON Schema 中的字符串数字，将它们转换为 number
       */
      const fixNumericStrings = (schema: JSONSchema): JSONSchema => {
        if (Array.isArray(schema)) {
          return schema.map((item) => fixNumericStrings(item));
        }

        if (typeof schema === "object" && schema !== null) {
          const newSchema: JSONSchema = {};
          for (const key in schema) {
            let value = schema[key];

            if (
              numericKeywords.has(key) &&
              typeof value === "string" &&
              !isNaN(Number(value))
            ) {
              value = Number(value); // ✅ 转换为数字
            } else if (typeof value === "object") {
              value = fixNumericStrings(value); // ✅ 递归处理
            }

            newSchema[key] = value;
          }
          return newSchema;
        }

        return schema;
      };
      const tools: ChatCompletionTool[] = toolRegistry
        .getFunctionDeclarations()
        .map((schema) => lowercaseType(schema))
        .map((item) => fixNumericStrings(item))
        .map((fn) => {
          return {
            type: "function",
            function: {
              name: fn.name || "",
              description: fn.description,
              parameters: fn.parameters,
            },
          };
        });

      // 初始化消息历史
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "user", content: prompt },
      ];

      // 工具调用循环，最多执行5次
      for (let i = 0; i < 500; i++) {
        const response = await this.openai.chat.completions.create({
          model: this.config.model,
          tools: tools.length > 0 ? tools : undefined,
          messages: messages,
        });

        const choice = response.choices[0];
        if (!choice) break;

        const message = choice.message;
        console.log("------------assistant message:", JSON.stringify(message));
        messages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls,
        });

        // 如果没有工具调用，返回结果
        if (!message.tool_calls || message.tool_calls.length === 0) {
          return message.content || "";
        }

        // 处理工具调用
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          let toolResult: any;
          const tool = toolRegistry.getTool(toolName);

          if (tool) {
            console.log("----------toolName:", toolName);
            console.log("----------toolArgs:", toolArgs);
            // 使用传入的工具管理器执行工具
            const result: ToolResult = await tool.execute(
              toolArgs,
              pendingSend.signal
            );
            toolResult = result.llmContent;
            console.log("----------toolResult:", toolResult);
          } else {
            // 默认工具处理
            toolResult = `工具 "${toolName}" 未找到或无法执行`;
          }

          // 将工具结果添加到消息历史
          messages.push({
            role: "tool",
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      }

      // 返回最后一次的结果
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        const content = lastMessage.content;
        return typeof content === "string"
          ? content
          : Array.isArray(content)
          ? content.map((c) => ("text" in c ? c.text : "")).join("")
          : "";
      }
      return "";
    } else if (this.config.provider === "anthropic" && this.anthropic) {
      const response = await (this.anthropic as any).messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      return content && "text" in content ? content.text : "";
    }

    throw new Error("未配置有效的LLM提供商");
  }

  // 构建代码分析提示词
  private buildCodeAnalysisPrompt(request: CodeAnalysisRequest): string {
    return `作为专业的代码分析专家，请深入分析以下${request.language}代码：

文件路径: ${request.filePath}
分析类型: ${request.analysisType}

代码内容:
\`\`\`${request.language}
${request.code}
\`\`\`

${
  request.context
    ? `
项目上下文:
- 项目结构: ${request.context.projectStructure}
- 依赖: ${request.context.dependencies?.join(", ")}
- 入口点: ${request.context.entryPoints?.join(", ")}
`
    : ""
}

请提供详细的分析结果，包括：
1. 代码功能概述
2. 关键实现细节
3. 潜在问题和风险
4. 优化建议
5. 代码质量评分（1-100）
6. 具体的改进示例

请使用中文回复，格式清晰，包含具体的代码示例。`;
  }

  // 构建项目分析提示词
  private buildProjectAnalysisPrompt(request: ProjectAnalysisRequest): string {
    //     const keyFilesContent = request.keyFiles
    //       .map(
    //         (file) =>
    //           `\`\`\`${file.language}
    // // ${file.path}
    // ${file.content.slice(0, 1000)}...
    // \`\`\``
    //       )
    //       .join("\n\n");

    return `作为资深架构师，请全面分析以下项目：

项目结构:
${request.projectStructure}

依赖列表:
${request.dependencies.join("\n")}

入口点:
${request.entryPoints.join("\n")}

分析目标: ${request.analysisGoal}

请提供：
1. 项目架构概述
2. 技术栈分析
3. 核心功能模块
4. 关键功能运行逻辑流程
5. 潜在问题和风险
6. 优化建议
7. 学习路径指导

请使用中文回复，结构清晰，便于开发者理解。`;
  }

  // 构建文档生成提示词
  private buildDocumentationPrompt(analysis: any): string {
    return `基于以下分析结果，生成专业的技术文档：

分析数据: ${JSON.stringify(analysis, null, 2)}

请生成包含以下内容的完整文档：
1. 项目概览
2. 技术架构
3. 核心功能
4. 代码质量分析
5. 部署指南
6. 贡献指南
7. API文档（如适用）

请使用Markdown格式，中文描述，包含代码示例和图表建议。`;
  }

  // 构建项目结构分析提示词
  private buildProjectStructurePrompt(request: any): string {
    return `作为资深架构师，请分析以下项目的结构：

分析目标: ${request.analysisGoal}
项目路径: ${request.repositoryPath}

请提供：
1. 项目结构概述
2. 包信息和依赖关系
3. 入口点文件
4. 关键配置文件

请使用JSON格式返回结果，包含projectStructure、packageInfo和entryPoints字段。`;
  }

  // 解析代码分析响应
  private parseCodeAnalysisResponse(response: string): CodeAnalysisResult {
    // 简单的响应解析，实际应用中可能需要更复杂的解析逻辑
    const lines = response.split("\n");
    const sections = {
      summary: "",
      keyInsights: [] as string[],
      potentialIssues: [] as string[],
      recommendations: [] as string[],
    };

    let currentSection = "";
    for (const line of lines) {
      if (line.includes("代码功能概述")) currentSection = "summary";
      else if (line.includes("关键实现")) currentSection = "keyInsights";
      else if (line.includes("潜在问题")) currentSection = "potentialIssues";
      else if (line.includes("优化建议")) currentSection = "recommendations";
      else if (line.trim() && currentSection) {
        if (currentSection === "summary") sections.summary += line + " ";
        else if (line.startsWith("-") || line.startsWith("•")) {
          const section = sections[currentSection as keyof typeof sections];
          if (Array.isArray(section)) {
            section.push(line.replace(/^[-•]\s*/, ""));
          }
        }
      }
    }

    return {
      summary: sections.summary.trim() || response.slice(0, 200) + "...",
      keyInsights: sections.keyInsights,
      potentialIssues: sections.potentialIssues,
      recommendations: sections.recommendations,
      codeQuality: {
        score: 75, // 可以从响应中提取
        metrics: {},
      },
    };
  }

  // 解析项目分析响应
  private parseProjectAnalysisResponse(response: string) {
    // 简化的解析逻辑
    return {
      architecture: response.slice(0, 500),
      technologyStack: ["React", "TypeScript", "Node.js"], // 从响应中提取
      keyFeatures: ["模块化设计", "RESTful API", "响应式界面"],
      potentialIssues: ["需要更多测试", "部分代码复杂度过高"],
      recommendations: ["增加单元测试", "优化复杂函数", "添加文档"],
    };
  }

  // 解析项目结构响应
  private parseProjectStructureResponse(response: string) {
    try {
      // 按行拆分
      const lines = response.split(/\r?\n/).map((response) => response.trim());

      // 如果第一行以 ``` 开头，删除
      if (lines[0].startsWith("```")) {
        lines.shift();
      }

      // 如果最后一行以 ``` 开头，删除
      if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) {
        lines.pop();
      }

      // 重新拼接成 JSON 字符串
      const jsonString = lines.join("\n").trim();
      // 尝试解析JSON响应
      const parsed = JSON.parse(jsonString);
      return {
        projectStructure: parsed.projectStructure || {},
        packageInfo: parsed.packageInfo || {},
        entryPoints: parsed.entryPoints || [],
      };
    } catch (error) {
      // 如果解析失败，返回默认结构
      return {
        projectStructure: {},
        packageInfo: {},
        entryPoints: [],
      };
    }
  }
}

// LLM客户端工厂
export function createLLMClient(
  config: LLMConfig,
  repositoryPath: string
): LLMClient {
  return new LLMClient(config, repositoryPath);
}

// // 默认客户端实例
// export const llmClient = createLLMClient({
//   provider:
//     (process.env.LLM_PROVIDER as "openai" | "anthropic" | "custom") || "openai",
//   apiKey: process.env.LLM_API_KEY || "",
//   model: process.env.LLM_MODEL || "gpt-4",
//   baseURL: process.env.LLM_BASE_URL,
//   maxTokens: 2000,
//   temperature: 0.3,
// });
