import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  ToolRegistry,
  Config,
  ConfigParameters,
  ToolResult,
  getFolderStructure,
} from "@google/gemini-cli-core";
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
  private repositoryPath: string;

  constructor(config: LLMConfig, repositoryPath: string) {
    this.config = config;
    const params: ConfigParameters = {
      sessionId: Date.now().toString(),
      targetDir: repositoryPath,
      debugMode: false,
      cwd: repositoryPath,
      model: "test-model",
    };
    this.repositoryPath = repositoryPath;
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

  async getEnv(): Promise<string> {
    const cwd = this.repositoryPath;
    const today = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const platform = process.platform;
    const folderStructure = await getFolderStructure(cwd, {
      fileService: this.geminiConfig.getFileService(),
    });
    const context = `
  This is the CodeGrain. We are setting up the context for our chat.
  Today's date is ${today}.
  My operating system is: ${platform}
  I'm currently working in the directory: ${cwd}
  ${folderStructure}
  -----------------------
  仔细分析当前项目的结构，找出并阅读项目中的核心代码。
  分析项目代码库的整体架构，核心业务流程，输出结构化架构文档和业务流程分析报告，并画出系统架构图和业务流程图。
  分析之前必须先列出计划，然后按计划逐步执行
  无需询问用户是否同意计划，直接执行计划
  每一步完成之后做出标记，并确认下一步的目标
  可以根据执行结果调整计划
  不可修改项目中中的任何文件
  ------------------------
  这个任务对我的职业生涯非常重要，现在开始吧
          `.trim();
    return context;
  }

  async analyzeProject(): Promise<string> {
    const initPrompt = await this.getEnv();
    const result = await this.callLLM(initPrompt);
    return result;
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

      const systemPropmt = `
        你是一位专业的软件架构师智能助手，专注于代码分析和体系结构设计。你的职责是解析用户提供的项目代码，识别其架构、模块和关键业务逻辑，并生成清晰、结构化的文档，包括架构设计文档和业务流程分析文档。你的知识储备包括软件工程、系统设计、面向对象编程、微服务架构、数据库设计和行业最佳实践。你能够以简洁、易懂的语言描述复杂的技术内容，并使用图表或伪代码来辅助说明。
 
        请根据以下要求完成内容生成：
        1. **代码分析**：系统性地分析用户提供的代码，识别系统的关键模块、依赖关系以及核心功能。
        2. **架构文档输出**：输出架构设计文档，包括系统组件划分、模块职责、依赖关系、技术选型、数据库设计，以及技术栈描述。
        3. **业务流程分析文档**：通过代码分析，总结主要业务流程，使用流程图或文字描述，清晰展示业务逻辑及其实现方式。
        4. **格式要求**：输出高质量、清晰的文档，支持使用 markdown 格式，必要时以表格、列表或图表的形式增强可读性。
        
        输入：用户提供的项目代码（或其描述），及任何补充信息。
        输出：详尽的架构设计文档和业务流程分析文档，条理分明、直观易懂。
        `;
      // 初始化消息历史
      let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPropmt },
        { role: "user", content: prompt },
      ];

      let summried = false;
      // 工具调用循环，最多执行500次
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
          if (summried) break;
          const isContinued = await this.checkIsContinued(message);
          if (isContinued) {
            messages.push({
              role: "user",
              content: "请继续",
            });
          } else if (!summried) {
            // 已完成分析，进入总结阶段
            messages.push({
              role: "user",
              content: `请将所有的分析汇总成一份完善的文档，并保存到${this.repositoryPath}路径下
                注意不要遗漏任何信息，并且可以补充你认为必要的内容，以markdown格式输出。
                回复内容不要包含文档之外的任何信息`,
            });
            summried = true;
          }
        } else {
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
              // console.log("----------toolResult:", toolResult);
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

  private async checkIsContinued(
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam
  ): Promise<boolean> {
    const CHECK_PROMPT = `Analyze *only* the content and structure of your immediately preceding response (your last turn in the conversation history). Based *strictly* on that response, determine who should logically speak next: the 'user' or the 'model' (you).
**Decision Rules (apply in order):**
1.  **Model Continues:** If your last response explicitly states an immediate next action *you* intend to take (e.g., "Next, I will...", "Now I'll process...", "Moving on to analyze...", indicates an intended tool call that didn't execute), OR if the response seems clearly incomplete (cut off mid-thought without a natural conclusion), then the **'model'** should speak next.
2.  **Question to User:** If your last response ends with a direct question specifically addressed *to the user*, then the **'model'** should speak next.
3.  **Next task:** If your last response completed a thought, statement, or task *and* have another task need to do. In this case, the **'model'** should speak next.
4.  **Waiting for User:** If your last response completed a thought, statement, or task *and* does not meet the criteria for Rule 1 (Model Continues) or Rule 2 (Question to User) or Rule 3 (Have todo task), it implies a pause expecting user input or reaction. In this case, the **'user'** should speak next.
**Output Format:**
Respond *only* in JSON format according to the following schema. Do not include any text outside the JSON structure.
\`\`\`json
{
  "type": "object",
  "properties": {
    "reasoning": {
        "type": "string",
        "description": "Brief explanation justifying the 'next_speaker' choice based *strictly* on the applicable rule and the content/structure of the preceding turn."
    },
    "next_speaker": {
      "type": "string",
      "enum": ["user", "model"],
      "description": "Who should speak next based *only* on the preceding turn and the decision rules."
    }
  },
  "required": ["next_speaker", "reasoning"]
}
\`\`\``;

    try {
      if (!this.openai) {
        throw new Error("OpenAI client not initialized");
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [message, { role: "user", content: CHECK_PROMPT }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      return result.next_speaker === "model";
    } catch (error) {
      console.error("Failed to check conversation continuation:", error);
      return false;
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
