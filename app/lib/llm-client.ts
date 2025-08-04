import { ToolResult } from '@google/gemini-cli-core';

import { Agent, AgentResult, ChatMessage } from './agent';

export type ToolCallContent =
  | {
      type: 'markdown';
      markdown: string;
    }
  | {
      type: 'diff';
      newText: string;
      oldText: string | null;
      path: string;
    };

// LLM配置接口
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
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
    | 'overview'
    | 'complexity'
    | 'security'
    | 'documentation'
    | 'optimization';
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
    if (typeof toolResult.returnDisplay === 'string') {
      return {
        type: 'markdown',
        markdown: toolResult.returnDisplay,
      };
    } else {
      return {
        type: 'diff',
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
  private config: LLMConfig;
  private repositoryPath: string;

  constructor(config: LLMConfig, repositoryPath: string) {
    this.config = config;
    this.repositoryPath = repositoryPath;
  }

  async analyzeProject(): Promise<string> {
    try {
      const actionPrompt = `仔细分析当前项目的结构，找出并阅读项目中的核心代码。
  分析项目代码库的整体架构，核心业务流程，输出结构化架构文档和业务流程分析报告，并画出系统架构图和业务流程图。
  分析之前必须先列出计划，然后按计划逐步执行
  无需询问用户是否同意计划，直接执行计划
  每一步完成之后做出标记，并确认下一步的目标
  可以根据执行结果调整计划
  不可修改项目中中的任何文件
  ------------------------
  这个任务对我的职业生涯非常重要，现在开始吧`;
      const rolePrompt = `你是一位专业的软件架构师智能助手，专注于代码分析和体系结构设计。你的职责是解析用户提供的项目代码，识别其架构、模块和关键业务逻辑，并生成清晰、结构化的文档，包括架构设计文档和业务流程分析文档。你的知识储备包括软件工程、系统设计、面向对象编程、微服务架构、数据库设计和行业最佳实践。你能够以简洁、易懂的语言描述复杂的技术内容，并使用图表或伪代码来辅助说明。
 
        请根据以下要求完成内容生成：
        1. **代码分析**：系统性地分析用户提供的代码，识别系统的关键模块、依赖关系以及核心功能。
        2. **架构文档输出**：输出架构设计文档，包括系统组件划分、模块职责、依赖关系、技术选型、数据库设计，以及技术栈描述。
        3. **业务流程分析文档**：通过代码分析，总结主要业务流程，使用流程图或文字描述，清晰展示业务逻辑及其实现方式。
        4. **格式要求**：输出高质量、清晰的文档，支持使用 markdown 格式，必要时以表格、列表或图表的形式增强可读性。
        
        输入：用户提供的项目代码（或其描述），及任何补充信息。
        输出：详尽的架构设计文档和业务流程分析文档，条理分明、直观易懂。`;
      const summaryPrompt = `请将以上所有的内容汇总成一份完善的文档
注意不要遗漏任何信息，并且可以补充你觉得有必要的内容
回复的内容不要包含文档之外的任何信息`;
      const agent = new Agent(this.config, this.repositoryPath);
      const result = await agent.execute({ actionPrompt, rolePrompt });
      const history = result.history;
      // 移除之前的系统提示词
      if (history[0].role === 'system') {
        history.shift();
      }
      const summaryResult = await agent.execute({
        actionPrompt: summaryPrompt,
        rolePrompt,
        history,
        withEnv: false,
      });
      return summaryResult.content;
    } catch (err: any) {
      if (err.message) {
        console.error(err.message);
      }
      throw new Error('智能分析失败');
    }
  }
}

// LLM客户端工厂
export function createLLMClient(
  config: LLMConfig,
  repositoryPath: string,
): LLMClient {
  return new LLMClient(config, repositoryPath);
}
