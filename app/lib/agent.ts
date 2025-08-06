import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  ToolRegistry,
  Config,
  ConfigParameters,
  ToolResult,
  getFolderStructure,
} from '@google/gemini-cli-core';
import { ChatCompletionTool } from 'openai/resources/index.mjs';
import { fixNumericStrings, lowercaseType } from './utils';

// LLM配置接口
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

// Agent配置接口
export interface AgentConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
  systemPrompt?: string;
}

// 工具定义
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: any) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
}

// 对话消息
export type ChatMessage = {
  role: 'function' | 'system' | 'developer' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  tool_call_id?: string;
};

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  result?: ToolResult;
}

// 执行结果
export interface AgentResult {
  content: string;
  iterations: number;
  success: boolean;
  error?: string;
  history: ChatMessage[];
}

const MAX_ITERATIONS = 500;

// Agent类
export class Agent {
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
      model: 'deepseek-chat',
    };
    this.repositoryPath = repositoryPath;
    this.geminiConfig = new Config(params);

    if (config.provider === 'openai' || config.provider === 'custom') {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    } else if (config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    }
  }

  // 主要的执行方法
  /**
   *
   */
  async execute({
    actionPrompt,
    rolePrompt,
    history = [],
    withEnv = true,
    jsonoutput = false,
  }: {
    actionPrompt: string;
    rolePrompt: string;
    history?: ChatMessage[];
    withEnv?: boolean;
    jsonoutput?: boolean;
  }): Promise<AgentResult> {
    const pendingSend = new AbortController();
    const abortSignal = pendingSend.signal;
    if (
      (this.config.provider === 'openai' ||
        this.config.provider === 'custom') &&
      this.openai
    ) {
      await this.geminiConfig.initialize();
      const toolRegistry: ToolRegistry =
        await this.geminiConfig.getToolRegistry();

      // Gemini CLI Core 中的 tool 到 OPENAI 的 tool 要做一些兼容转换
      // google_web_search
      const tools: ChatCompletionTool[] = toolRegistry
        .getFunctionDeclarations()
        .filter((item) => item.name !== 'read_many_files')
        .map((schema) => lowercaseType(schema))
        .map((item) => fixNumericStrings(item))
        .map((fn) => {
          return {
            type: 'function',
            function: {
              name: fn.name || '',
              description: fn.description,
              parameters: fn.parameters,
            },
          };
        });

      const envPrompt = withEnv ? await this.getEnv() : '';
      const systemPropmt = `
      ${envPrompt}
      ----------------------  
      ${rolePrompt}
        `;
      // 初始化消息历史
      let messages: ChatMessage[] = [
        { role: 'system', content: systemPropmt },
        ...history,
        { role: 'user', content: actionPrompt },
      ];

      let it = 0;
      // 工具调用循环，最多执行500次
      while (it < MAX_ITERATIONS) {
        try {
          const params = {
            model: this.config.model,
            tools: tools.length > 0 ? tools : undefined,
            messages:
              messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          };
          if (jsonoutput) {
            (params as any).response_format = {
              type: 'json_object',
            };
          }
          const response = await this.openai.chat.completions.create(params, {
            signal: abortSignal,
          });
          it++;
          const choice = response.choices[0];
          if (!choice) break;

          const message = choice.message;
          console.log(
            '------------assistant message:',
            JSON.stringify(message),
          );
          messages.push({
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls,
          });

          // 如果没有工具调用，返回结果
          if (!message.tool_calls || message.tool_calls.length === 0) {
            if (jsonoutput) {
              // 结构化输出时无需判断
              break;
            }
            const isContinued = await this.checkIsContinued(message);
            if (isContinued) {
              messages.push({
                role: 'user',
                content: '请继续',
              });
            } else {
              break;
            }
          } else {
            // 处理工具调用
            for (const toolCall of message.tool_calls) {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);

              let toolResult: any;
              const tool = toolRegistry.getTool(toolName);

              if (tool) {
                console.log('----------toolName:', toolName);
                console.log('----------toolArgs:', toolArgs);
                // 使用传入的工具管理器执行工具
                const result: ToolResult = await tool.execute(
                  toolArgs,
                  pendingSend.signal,
                );
                toolResult = result.llmContent;
              } else {
                // 默认工具处理
                toolResult = `工具 "${toolName}" 未找到或无法执行`;
              }

              // 将工具结果添加到消息历史
              messages.push({
                role: 'tool',
                content: toolResult,
                tool_call_id: toolCall.id,
              });
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.error('请求已中止');
          } else {
            console.error('出错:', err);
          }
        }
      }

      // 返回最后一次的结果
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const content = lastMessage.content;
        const lastResult = content;
        return {
          content: lastResult,
          iterations: it,
          success: true,
          history: messages,
        };
      }
      return {
        content: '',
        iterations: it,
        success: false,
        error: '执行失败，详情请查看历史记录',
        history: messages,
      };
    } else if (this.config.provider === 'anthropic' && this.anthropic) {
      // TODO
    }

    throw new Error('未配置有效的LLM提供商');
  }

  private async checkIsContinued(
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam,
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
        throw new Error('OpenAI client not initialized');
      }

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [message, { role: 'user', content: CHECK_PROMPT }],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      console.log(
        `~~~~~~~~~~~~~~~~~~~~判断是否继续~~~~~~~~~~~~~~~~~~~~~~~

        `,
        result,
      );
      return result.next_speaker === 'model';
    } catch (error) {
      console.error('Failed to check conversation continuation:', error);
      return false;
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
    This is the CodeGrain. We are setting up the context for our chat.
    Today's date is ${today}.
    My operating system is: ${platform}
    I'm currently working in the directory: ${cwd}
    ${folderStructure}
            `.trim();
    return context;
  }
}
