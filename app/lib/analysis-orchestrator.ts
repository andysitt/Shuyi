import { WriteFileTool, WriteFileToolParams } from '@google/gemini-cli-core';
import { LLMClient, createLLMClient } from './llm-client';
import { SessionManager } from './llm-tools/session-manager';
import { cacheManager } from './cache-manager';
import {
  AnalysisResult,
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
  LLMInsights,
} from '@/app/types';
import { Agent, AgentResult } from './agent';
import { PromptBuilder } from './llm-tools/prompt-builder';
import { DocsManager } from './docs-manager';

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
  private llmClient: LLMClient;
  private sessionManager: SessionManager;
  private config: AnalysisConfig;
  private basePath: string;
  private agent: Agent;

  constructor(config: AnalysisConfig, repositoryPath: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.llmClient = createLLMClient(config.llmConfig, repositoryPath);
    this.sessionManager = new SessionManager(repositoryPath);
    this.agent = new Agent(this.config.llmConfig, this.basePath);
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
      onProgress?.({ stage: '制定分析计划', progress: 30 });
      const plan = await this.plan();

      onProgress?.({ stage: '分解分析任务', progress: 50 });
      const tasks = await this.buildTasks(plan.content);
      const res = JSON.parse(tasks.content);
      const taskList = res.document_tasks;

      if (Array.isArray(taskList)) {
        const repositoryUrlEncoded = repositoryUrl
          .replaceAll('http://', '')
          .replaceAll('https://', '')
          .replaceAll('/', '|');
        for (let i = 0; i < taskList.length; i++) {
          onProgress?.({ stage: '编写分析文档', progress: 70 + i });
          const result = await this.write(taskList[i]);

          DocsManager.saveDoc(
            repositoryUrlEncoded,
            taskList[i].title.trim(),
            result.content,
          );
        }
        const outline = taskList
          .map((doc) => {
            return `- [${doc.title.trim()}](/docs/${repositoryUrlEncoded}/${doc.title.trim()}.md)`;
          })
          .join('\n\n');
        const sidebar = `<!-- docs/_sidebar.md -->
${outline}
`;
        DocsManager.saveDoc(repositoryUrlEncoded, '_siderbar', sidebar);
      }

      onProgress?.({ stage: '完成', progress: 100 });
      const result = this.buildFinalResult(repositoryMetadata, '');
      return result;
    } finally {
      this.sessionManager.endSession(session.sessionId);
    }
  }

  // 执行LLM智能分析
  private async performLLMAnalysis(
    repositoryPath: string,
    repositoryUrl: string,
  ): Promise<string> {
    const cacheKey = `ai_analysis_${repositoryUrl}`;
    let llmInsights = await cacheManager.get(cacheKey);

    if (!llmInsights) {
      llmInsights = await this.llmClient.analyzeProject(); // 传递工具管理器以支持工具调用

      await cacheManager.set(cacheKey, llmInsights, 7200); // 2小时缓存
    }

    return llmInsights;
  }

  // 制定文档编写计划
  private async plan(): Promise<AgentResult> {
    const actionPrompt = `请阅读当前代码库，编制出相应的文档编写计划
    在此过程中你可以使用工具来进行查询项目结构、阅读代码等必要的操作
    代码库中已有的文档也可以作为参考
    如果文档和代码有不一致的地方，请以代码为准
    最后请输出一份Markdown格式的文档编写计划
    `;
    const result = await this.agent.execute({
      actionPrompt,
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_PLANNER,
    });
    return result;
  }

  // 根据编写计划制定编写任务
  private async buildTasks(plan: string) {
    const actionPrompt = `请根据以下文档编写计划来生成一份文档编写任务列表，以下是具体的计划
    ------------------------------
  ${plan}
    `;
    const result = await this.agent.execute({
      actionPrompt,
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_SCHEDULER,
      withEnv: false,
      jsonoutput: true,
    });
    return result;
  }

  // 执行具体编写任务
  private async write(task: {
    title: string;
    goal: string;
    outline: string;
    targetReader: string;
  }) {
    const actionPrompt = `请根据以下要求来生编写一篇文档
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
    const result = await this.agent.execute({
      actionPrompt,
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_WRITER,
      withEnv: true,
    });
    return result;
  }

  // 创建 docsify 目录
  private async buildSideBar() {}
  // 构建最终结果
  private async buildFinalResult(
    metadata: RepositoryMetadata,
    llmInsights: string,
  ): Promise<AnalysisResult> {
    // 创建默认的结构信息
    const structure: RepositoryStructure = {
      root: {
        name: metadata.name,
        type: 'directory',
        path: '.',
        size: metadata.size,
      },
      totalFiles: 0,
      totalDirectories: 0,
      languages: { [metadata.language]: metadata.size },
      keyFiles: [],
    };

    // 创建默认的依赖信息
    const dependencies: DependencyInfo[] = Object.entries(
      metadata.topics || {},
    ).map(([name, version]) => ({
      name,
      version: version as string,
      type: 'production',
    }));

    // 创建默认的代码质量指标
    const codeQuality: CodeQualityMetrics = {
      complexity: { average: 0, max: 0, files: [] },
      duplication: 0,
      maintainability: 0,
      securityIssues: [],
    };

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
