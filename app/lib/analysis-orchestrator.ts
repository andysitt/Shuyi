import { SessionManager } from './llm-tools/session-manager';
import {
  AnalysisResult,
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
} from '@/app/types';
import { Agent } from './agent';
import { PromptBuilder } from './llm-tools/prompt-builder';
import { DocsManager } from './docs-manager';
import {
  analyzeStructure,
  analyzeDependencies,
  analyzeCodeQuality,
} from './analysis-tools';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { JsonOutputParser } from '@langchain/core/output_parsers';

// 分析配置
export interface AnalysisConfig {
  llmConfig: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  analysisType: 'full' | 'structure' | 'quality' | 'security' | 'documentation';
  maxFileSize?: number;
  maxFilesToAnalyze?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

// 分析进度回调
export interface AnalysisProgress {
  stage: string;
  progress: number;
  details?: string;
}

// 分析协调器
export class AnalysisOrchestrator {
  private sessionManager: SessionManager;
  private config: AnalysisConfig;
  private basePath: string;

  constructor(config: AnalysisConfig, repositoryPath: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.sessionManager = new SessionManager(repositoryPath);
  }

  // 结构分析方法
  private async analyzeStructure(
    repositoryPath: string,
  ): Promise<RepositoryStructure> {
    return await analyzeStructure(repositoryPath);
  }

  // 依赖分析方法
  private async analyzeDependencies(
    repositoryPath: string,
  ): Promise<DependencyInfo[]> {
    return await analyzeDependencies(repositoryPath);
  }

  // 代码质量分析方法
  private async analyzeCodeQuality(
    repositoryPath: string,
  ): Promise<CodeQualityMetrics> {
    return await analyzeCodeQuality(repositoryPath);
  }

  // 主分析流程
  async analyzeRepository(
    repositoryUrl: string,
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const session = await this.sessionManager.createSession(
      'full_analysis',
      repositoryPath,
    );

    try {
      onProgress?.({ stage: '分析结构信息', progress: 20 });
      const structure = await this.analyzeStructure(repositoryPath);
      onProgress?.({ stage: '分析依赖信息', progress: 30 });
      const dependencies = await this.analyzeDependencies(repositoryPath);
      onProgress?.({ stage: '分析代码质量', progress: 40 });
      const codeQuality = await this.analyzeCodeQuality(repositoryPath);
      onProgress?.({ stage: '开始 AI 智能分析', progress: 45 });
      await this.performLLMAnalysis(repositoryUrl, onProgress);
      const result = this.buildFinalResult(
        repositoryMetadata,
        structure,
        dependencies,
        codeQuality,
        '',
      );
      return result;
    } finally {
      this.sessionManager.endSession(session.sessionId);
    }
  }

  // 执行LLM智能分析 - 使用LangChain Chain重构
  private async performLLMAnalysis(
    repositoryUrl: string,
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<boolean> {
    try {
      const llm = new ChatOpenAI({
        apiKey: this.config.llmConfig.apiKey,
        modelName: this.config.llmConfig.model,
        temperature: 0,
        configuration: {
          baseURL: this.config.llmConfig.baseURL,
        },
      });

      // 1. 创建计划链
      onProgress?.({ stage: 'AI智能分析-制定分析计划', progress: 60 });
      const plannerPrompt = ChatPromptTemplate.fromMessages([
        ['system', PromptBuilder.SYSTEM_PROMPT_PLANNER],
        ['human', '{input}'],
      ]);
      const plannerChain = plannerPrompt
        .pipe(llm)
        .pipe(new StringOutputParser());
      const plan = await plannerChain.invoke({
        input: `请阅读当前代码库，编制出相应的文档编写计划。在此过程中你可以使用工具来进行查询项目结构、阅读代码等必要的操作。最后请输出一份Markdown格式的文档编写计划。`,
      });

      // 2. 创建任务调度链
      onProgress?.({ stage: 'AI智能分析-分解分析任务', progress: 70 });
      console.log('------plan', plan);
      const schedulerPrompt = ChatPromptTemplate.fromMessages([
        ['system', PromptBuilder.SYSTEM_PROMPT_SCHEDULER],
        [
          'human',
          `请根据以下文档编写计划来生成一份文档编写任务列表，以下是具体的计划
------------------------------
{plan}`,
        ],
      ]);
      const schedulerChain = schedulerPrompt
        .pipe(llm)
        .pipe(new JsonOutputParser());
      const tasksResult = await schedulerChain.invoke({
        plan,
        json: PromptBuilder.SYSTEM_PROMPT_SCHEDULER_JSON,
      });
      console.log('-----tasksResult', tasksResult);
      const taskList = (tasksResult as any).document_tasks;

      if (Array.isArray(taskList)) {
        const repositoryUrlEncoded = repositoryUrl
          .replaceAll('http://', '')
          .replaceAll('https://', '')
          .replaceAll('/', '|');
        taskList.unshift({
          title: '概述',
          goal: '对当前项目进行简要介绍',
          outline: '按当前项目内容自由发挥',
          targetReader: '项目的目标用户',
        });

        // 3. 并行执行所有文档编写任务 (使用重构后的Agent)
        const writePromises = taskList.map(async (task, index) => {
          try {
            const result = await this.write(task);
            await DocsManager.saveDoc(
              repositoryUrlEncoded,
              task.title.replaceAll(' ', ''),
              result.content,
            );
            onProgress?.({
              stage: 'AI智能分析-编写分析文档',
              progress: 80 + Math.floor(((index + 1) / taskList.length) * 20),
            });
            return { success: true, task };
          } catch (error) {
            console.error(`AI智能分析-编写文档 "${task.title}" 失败:`, error);
            return { success: false, task, error };
          }
        });

        await Promise.all(writePromises);

        // 生成侧边栏
        const outline = taskList
          .map((doc) => {
            return `- [${doc.title}](${doc.title.replaceAll(' ', '')}.md)`;
          })
          .join('\n\n');
        const sidebar = `<!-- docs/_sidebar.md -->\n${outline}`;
        await DocsManager.saveDoc(repositoryUrlEncoded, '_sidebar', sidebar);

        onProgress?.({ stage: 'AI智能分析-完成', progress: 100 });
      }
      return true;
    } catch (e: any) {
      console.error(e);
      onProgress?.({
        stage: 'AI智能分析-失败',
        progress: 0,
        details: e.message || '未知错误',
      });
      return false;
    }
  }

  // 执行具体编写任务 - 此方法保持不变，因为它需要一个具备工具使用能力的完整Agent
  private async write(task: {
    title: string;
    goal: string;
    outline: string;
    targetReader: string;
  }) {
    const actionPrompt = `结合当前仓库中的代码，根据以下要求来编写一篇文档
    如若需要，你可以使用工具来阅读当前仓库中的任何文件
    最终输出不要包含任何文档之外的内容，文档中也不要包含任何外部资源引用和外部链接
    ------------------------------
    ## 标题
    ${task.title}
    ## 写作目标
    ${task.goal}
    ## 大纲: 
    \`\`\`
    ${task.outline}
    \`\`\`
    ## 目标读者
    ${task.targetReader}
    `;
    const agent = new Agent(this.config.llmConfig, this.basePath);
    const result = await agent.execute({
      actionPrompt,
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_WRITER,
      withEnv: true,
    });
    return result;
  }

  // 构建最终结果
  private async buildFinalResult(
    metadata: RepositoryMetadata,
    structure: RepositoryStructure,
    dependencies: DependencyInfo[],
    codeQuality: CodeQualityMetrics,
    llmInsights: string,
  ): Promise<AnalysisResult> {
    return {
      metadata,
      structure,
      dependencies,
      codeQuality,
      llmInsights,
    };
  }
}

// 创建分析协调器工厂
export function createAnalysisOrchestrator(
  config: AnalysisConfig,
  repositoryPath: string,
) {
  return new AnalysisOrchestrator(config, repositoryPath);
}
