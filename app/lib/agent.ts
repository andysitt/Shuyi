import { Config, ConfigParameters, getFolderStructure, ToolRegistry } from '@google/gemini-cli-core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  createToolCallingAgent,
  AgentExecutor,
  CreateToolCallingAgentParams,
  AgentExecutorInput,
} from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { wrapToolsForLangChain } from './langchain-tools';

// LLM配置接口
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  apiKey: string | string[];
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

// 对话消息 - 保持与项目其余部分的兼容性
export type ChatMessage = {
  role: 'function' | 'system' | 'developer' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[]; // 简化类型以实现兼容性
  tool_call_id?: string;
};

// 执行结果
export interface AgentResult {
  content: string;
  iterations: number; // LangChain AgentExecutor不直接暴露迭代次数，这里可以设为1或移除
  success: boolean;
  error?: string;
  history: ChatMessage[];
}

// Agent类
export class Agent {
  private config: LLMConfig;
  private geminiConfig: Config;
  private repositoryPath: string;
  private _apiKeys: string[];
  private _apiKeyIndex: number = 0;

  constructor(config: LLMConfig, repositoryPath: string) {
    this.config = config;
    this.repositoryPath = repositoryPath;
    if (Array.isArray(config.apiKey)) {
      this._apiKeys = config.apiKey;
    } else {
      this._apiKeys = config.apiKey.split(',').map((k) => k.trim());
    }

    const params: ConfigParameters = {
      sessionId: Date.now().toString(),
      targetDir: repositoryPath,
      debugMode: false,
      cwd: repositoryPath,
      model: config.model, // 使用传入的model
    };
    this.geminiConfig = new Config(params);
  }

  private _getNextApiKey(): string {
    if (this._apiKeys.length === 0) {
      throw new Error('No API keys provided.');
    }
    const key = this._apiKeys[this._apiKeyIndex];
    this._apiKeyIndex = (this._apiKeyIndex + 1) % this._apiKeys.length;
    return key;
  }

  // 主要的执行方法 - 使用LangChain重构
  async execute({
    actionPrompt,
    rolePrompt,
    history = [],
    withEnv = true,
    jsonOutput = false,
    actionPromptParams = {},
    rolePromptParams = {},
    withTools = true,
  }: {
    actionPrompt: string;
    rolePrompt: string;
    actionPromptParams?: Record<string, string>;
    rolePromptParams?: Record<string, string>;
    history?: ChatMessage[];
    withEnv?: boolean;
    jsonOutput?: boolean;
    withTools?: boolean;
  }): Promise<AgentResult> {
    await this.geminiConfig.initialize();
    const toolRegistry: ToolRegistry = await this.geminiConfig.getToolRegistry();

    const tools = wrapToolsForLangChain(toolRegistry);

    const envPrompt = withEnv ? await this.getEnv() : '';
    const systemPromptContent = `
      ${envPrompt}
      ----------------------  
      ${rolePrompt}
    `;

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPromptContent],
      new MessagesPlaceholder('chat_history'),
      ['human', actionPrompt],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    let llm;

    switch (this.config.provider) {
      case 'openai':
      case 'custom':
        const modelKwargs: Record<string, any> = {};
        if (jsonOutput) {
          modelKwargs.response_format = { type: 'json_object' };
        }
        llm = new ChatOpenAI({
          apiKey: this._getNextApiKey(),
          modelName: this.config.model,
          temperature: this.config.temperature || 0,
          configuration: {
            baseURL: this.config.baseURL,
          },
          modelKwargs,
        });
        break;
      case 'google':
        llm = new ChatGoogleGenerativeAI({
          apiKey: this._getNextApiKey(),
          model: this.config.model,
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        });
        break;
      case 'anthropic':
        llm = new ChatAnthropic({
          apiKey: this._getNextApiKey(),
          modelName: this.config.model,
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    const agentOptions: CreateToolCallingAgentParams = {
      llm,
      prompt,
      tools: [],
    };
    if (withTools) {
      agentOptions.tools = tools;
    }
    const agent = await createToolCallingAgent(agentOptions);

    const agentExecutorOptions: AgentExecutorInput = {
      agent,
      tools: [],
      verbose: false, // 在开发过程中设为true以观察agent的思考过程
      maxIterations: 100,
    };
    if (withTools) {
      agentExecutorOptions.tools = tools;
    }
    const agentExecutor = new AgentExecutor(agentExecutorOptions);

    // 将我们的历史消息格式转换为LangChain的格式
    const chatHistory = history.map((msg) => {
      switch (msg.role) {
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage({
            content: msg.content,
            tool_calls: msg.tool_calls,
          });
        case 'tool':
          return new ToolMessage({
            content: msg.content,
            tool_call_id: msg.tool_call_id!,
          });
        default:
          // 对于其他未处理的角色，可以打印警告或返回一个默认值
          console.warn(`Unhandled message role: ${msg.role}`);
          // 暂时返回HumanMessage以避免执行中断，但长远来看应处理所有情况
          return new HumanMessage(msg.content);
      }
    });

    try {
      const result = await agentExecutor.invoke({
        ...actionPromptParams,
        ...rolePromptParams,
        chat_history: chatHistory,
      });
      // 将LangChain的输出格式转换回我们的AgentResult格式
      const finalHistory: ChatMessage[] = [
        ...history,
        { role: 'user', content: actionPrompt },
        { role: 'assistant', content: result.output },
      ];

      return {
        content: result.output as string,
        iterations: 1, // AgentExecutor不直接暴露，可以简化或移除
        success: true,
        history: finalHistory,
      };
    } catch (error: any) {
      console.error('LangChain Agent a an error:', error);
      return {
        content: '',
        iterations: 0,
        success: false,
        error: error.message,
        history: history, // 返回原始历史
      };
    }
  }

  async getEnv(): Promise<string> {
    const cwd = this.repositoryPath;
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const platform = process.platform;
    const folderStructure = await getFolderStructure(cwd, {
      fileService: this.geminiConfig.getFileService(),
    });
    const context = `
    This is the Shuyi. We are setting up the context for our chat.
    Today's date is ${today}.
    My operating system is: ${platform}
    I'm currently working in the directory: ${cwd}
    ${folderStructure}
            `.trim();
    return context;
  }
}
