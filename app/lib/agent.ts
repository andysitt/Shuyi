import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  ToolRegistry,
  Config,
  ConfigParameters,
  ToolResult,
  getFolderStructure,
  ChatCompressionInfo,
} from '@google/gemini-cli-core';
import {
  ChatCompletionChunk,
  ChatCompletionTool,
} from 'openai/resources/index.mjs';
import { fixNumericStrings, lowercaseType, tokenLimit } from './utils';
import { PromptBuilder } from './llm-tools/prompt-builder';
import { Stream } from 'openai/streaming.mjs';

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
  private messages: ChatMessage[];
  COMPRESSION_TOKEN_THRESHOLD: number;
  constructor(config: LLMConfig, repositoryPath: string) {
    this.config = config;
    const params: ConfigParameters = {
      sessionId: Date.now().toString(),
      targetDir: repositoryPath,
      debugMode: false,
      cwd: repositoryPath,
      model: 'deepseek-reasoner',
    };
    this.repositoryPath = repositoryPath;
    this.geminiConfig = new Config(params);
    this.messages = [];
    this.COMPRESSION_TOKEN_THRESHOLD = 0.8;

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
    jsonOutput = false,
  }: {
    actionPrompt: string;
    rolePrompt: string;
    history?: ChatMessage[];
    withEnv?: boolean;
    jsonOutput?: boolean;
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
        .filter((item) => item.name !== 'read_many_files') // 这个工具的返回 deepseek 无法解析
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
      this.messages = [
        { role: 'system', content: systemPropmt },
        ...history,
        { role: 'user', content: actionPrompt },
      ];

      let it = 0;
      let currentTokens = 0;
      // 工具调用循环，最多执行500次
      while (it < MAX_ITERATIONS) {
        try {
          if (
            currentTokens >
            this.COMPRESSION_TOKEN_THRESHOLD * tokenLimit(this.config.model)
          ) {
            const result = await this.tryCompressChat();
            console.log('--------历史消息压缩----------：', result);
            this.messages = [
              { role: 'system', content: systemPropmt },
              ...history,
              { role: 'user', content: actionPrompt },
              { role: 'assistant', content: result?.content || '' },
              { role: 'user', content: '历史消息已压缩，请继续' },
            ];
          }
          const params = {
            temperature: 0,
            max_tokens: 8129,
            model: this.config.model,
            tools: tools.length > 0 ? tools : undefined,
            messages: this
              .messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
          };
          if (jsonOutput) {
            (params as any).response_format = {
              type: 'json_object',
            };
          }
          const stream: Stream<ChatCompletionChunk> =
            await this.openai.chat.completions.create(
              {
                ...params,
                stream: true,
                stream_options: { include_usage: true },
              },
              {
                signal: abortSignal,
              },
            );
          it++;

          let content = '';
          const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] =
            [];

          for await (const chunk of stream) {
            if (chunk.usage) {
              currentTokens = chunk.usage.total_tokens;
            }
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
            }

            if (delta.tool_calls) {
              for (const toolCallDelta of delta.tool_calls) {
                if (typeof toolCallDelta.index !== 'number') continue;
                const index = toolCallDelta.index;

                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                }
                if (toolCallDelta.id) {
                  toolCalls[index].id = toolCallDelta.id;
                }
                if (toolCallDelta.function?.name) {
                  toolCalls[index].function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  toolCalls[index].function.arguments +=
                    toolCallDelta.function.arguments;
                }
              }
            }
          }

          const toolCallsResult = toolCalls.filter(Boolean);
          const message: OpenAI.Chat.Completions.ChatCompletionMessage = {
            role: 'assistant',
            content: content || null,
            tool_calls:
              toolCallsResult.length > 0 ? toolCallsResult : undefined,
            refusal: null,
          };
          console.log(
            '------------assistant message:',
            JSON.stringify(message),
          );
          this.messages.push({
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls,
          });

          // 如果没有工具调用，返回结果
          if (!message.tool_calls || message.tool_calls.length === 0) {
            if (jsonOutput) {
              // 结构化输出时无需判断
              break;
            }
            const isContinued = await this.checkIsContinued(message);
            if (isContinued) {
              this.messages.push({
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
              this.messages.push({
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
      const lastMessage = this.messages[this.messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const content = lastMessage.content;
        const lastResult = content;
        return {
          content: lastResult,
          iterations: it,
          success: true,
          history: this.messages,
        };
      }
      return {
        content: '',
        iterations: it,
        success: false,
        error: '执行失败，详情请查看历史记录',
        history: this.messages,
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
      delete (message as any).reasoning_content;
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [message, { role: 'user', content: CHECK_PROMPT }],
        response_format: { type: 'json_object' },
        max_tokens: 8129,
        temperature: 0,
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

  async tryCompressChat(): Promise<AgentResult | null> {
    const curatedHistory = [...this.messages];

    const compressPrompt = PromptBuilder.getCompressionPrompt();
    curatedHistory.shift();
    const result = await this.execute({
      actionPrompt:
        'First, reason in your scratchpad. Then, generate the <state_snapshot>.',
      rolePrompt: compressPrompt,
      history: curatedHistory,
    });

    return result;
  }
}
