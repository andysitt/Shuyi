import { SessionManager } from '../lib/llm-tools/session-manager';
import {
  AnalysisResult,
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
  Language,
  AnalysisConfig,
  AnalysisProgress,
  ProjectOverview,
  DependencyGraph,
  CoreFeatures,
} from '@/app/types';
import { Agent } from '../lib/agent';
import { PromptBuilder } from '../lib/llm-tools/prompt-builder';
import { DocsManager } from './docs-manager';
import { analyzeStructure, analyzeDependencies, analyzeCodeQuality } from './analysis-tools';
import { progressManager } from './progress-manager';

function safeJsonParse(str: string) {
  // 1. 找到第一个 "{" 和最后一个 "}"
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || start >= end) {
    console.log('=========================json parse failed:', str);
    throw new Error('输入中找不到合法的 JSON 包裹符号 { ... }');
  }

  // 2. 裁剪出 JSON 主体
  let jsonStr = str.slice(start, end + 1);

  // // 3. 替换未转义的换行符
  // jsonStr = jsonStr.replace(/(?<!\\)\r?\n/g, '\\n');

  // 4. 尝试解析
  try {
    // 第一次尝试
    return JSON.parse(jsonStr);
  } catch (e) {
    // 记录下失败的数据
    console.log('=========================json parse failed:', jsonStr);
    // const fixed = str.replace(/(?<!\\)?/g, '\\n');
    return JSON.parse(jsonStr);
  }
}

// 分析协调器
export class AnalysisOrchestrator {
  private sessionManager: SessionManager;
  private config: AnalysisConfig;
  private basePath: string;
  private agent: Agent;
  constructor(config: AnalysisConfig, repositoryPath: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.sessionManager = new SessionManager(repositoryPath);
    this.agent = new Agent(this.config.llmConfig, this.basePath);
  }

  // 结构分析方法
  private async analyzeStructure(repositoryPath: string): Promise<RepositoryStructure> {
    return await analyzeStructure(repositoryPath);
  }

  // 依赖分析方法
  private async analyzeDependencies(repositoryPath: string): Promise<DependencyInfo[]> {
    return await analyzeDependencies(repositoryPath);
  }

  // 代码质量分析方法
  private async analyzeCodeQuality(repositoryPath: string): Promise<CodeQualityMetrics> {
    return await analyzeCodeQuality(repositoryPath);
  }

  // 主分析流程
  async analyzeRepository(
    repositoryUrl: string,
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const session = await this.sessionManager.createSession('full_analysis', repositoryPath);

    try {
      onProgress?.({ stage: '分析结构信息', progress: 20 });
      const structure = await this.analyzeStructure(repositoryPath);
      onProgress?.({ stage: '分析依赖信息', progress: 30 });
      const dependencies = await this.analyzeDependencies(repositoryPath);
      onProgress?.({ stage: '分析代码质量', progress: 40 });
      const codeQuality = await this.analyzeCodeQuality(repositoryPath);
      onProgress?.({ stage: '开始 AI 智能分析', progress: 45 });
      await this.performLLMAnalysis(repositoryUrl, onProgress);
      const result = this.buildFinalResult(repositoryMetadata, structure, dependencies, codeQuality, '');
      return result;
    } catch (error) {
      await progressManager.delete(repositoryUrl);
      throw error;
    } finally {
      this.sessionManager.endSession(session.sessionId);
    }
  }

  private async runTask1_generateOverview(): Promise<ProjectOverview> {
    try {
      console.log('Running Task 1: Generate Project Overview');
      const result = await this.agent.execute({
        actionPrompt: `Given the repository directory and file paths, please:
1) Identify the main modules (at the directory level) and their responsibilities, explaining each in one sentence and listing representative files .
2) Infer the technology stack (language/framework/database/message queue/build tool) and provide evidence paths.
3) Enumerate entry candidates (e.g., main.py, index.tsx, server.ts, bin/cli, Docker CMD), each with a detection reason.
Output the final result in JSON format:
{OUTPUT_EXP}
Only output JSON.`,
        actionPromptParams: {
          OUTPUT_EXP:
            '{"modules": [{ "path": string, "role": string, "examples": string[] }],"techStack": [{ "type": "language|framework|db|runtime|build", "name": string, "evidence": string[] }],"entryCandidates": [{ "path": string, "why": string }],"notes": string[]}',
        },
        rolePrompt:
          'You will extract "structure → responsibilities → tech stack → entry candidates" from file lists and path patterns. Do not recite source code, only output conclusions and evidence (file paths/names).',
        jsonOutput: true,
        withEnv: true,
        withTools: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to generate project overview');
      }

      const overview = safeJsonParse(result.content);

      return overview;
    } catch (error) {
      console.error('Error in runTask1_generateOverview:', error);
      throw new Error(`Task 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask2_analyzeDependencies(overview: ProjectOverview): Promise<DependencyGraph> {
    try {
      console.log('Running Task 2: Analyze Dependencies');
      const result = await this.agent.execute({
        actionPrompt: `Based on the following information, build the dependency/call relationships:
- Project Overview: {PROJECT_OVERVIEW_JSON}

Please output:
{OUTPUT_EXP}
Note:
- hotspots: Identify by fan-in + fan-out (the higher, the more core).
**Only output JSON.**`,
        actionPromptParams: {
          PROJECT_OVERVIEW_JSON: JSON.stringify(overview, null, 2),
          OUTPUT_EXP:
            '{"moduleGraph": [{ "from": string, "to": string, "type": "import|runtime|io" }],"callGraph": [{ "caller": string, "callee": string, "file": string, "line": number }],"hotspots": [{ "symbol": string, "fanIn": number, "fanOut": number, "files": string[] }]}',
        },
        rolePrompt: 'You will construct dependency/call relationships from the provided information.',
        jsonOutput: true,
        withEnv: true,
        withTools: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to analyze dependencies');
      }

      return safeJsonParse(result.content);
    } catch (error) {
      console.error('Error in runTask2_analyzeDependencies:', error);
      throw new Error(`Task 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask3_identifyCoreFeatures(
    overview: ProjectOverview,
    dependencies: DependencyGraph,
  ): Promise<CoreFeatures> {
    try {
      console.log('Running Task 3: Identify Core Features');
      const result = await this.agent.execute({
        actionPrompt: `Please identify the "Core Features" of the project and score each feature and list the evidence. The following clues can be used:
- Entry points and startup process: {ENTRY_CANDIDATES_FROM_OVERVIEW}
- Module responsibilities: {MODULES_FROM_OVERVIEW}
- Call/dependency hotspots: {HOTSPOTS_FROM_DEPGRAPH}

Output:
{OUTPUT_EXP}
Only output JSON.`,
        actionPromptParams: {
          ENTRY_CANDIDATES_FROM_OVERVIEW: JSON.stringify(overview.entryCandidates, null, 2),
          MODULES_FROM_OVERVIEW: JSON.stringify(overview.modules, null, 2),
          HOTSPOTS_FROM_DEPGRAPH: JSON.stringify(dependencies.hotspots, null, 2),
          OUTPUT_EXP: `{ "features": [{ "id": string,"name": string,"whyCore": string,"importance": number,"evidence": string[],"entryPoints": string[],"primaryModules": string[],"keySymbols": string[]}],"rankingRule": "importance desc, then evidence count desc"}`,
        },
        rolePrompt:
          'Infer "core features" (feature domain/use case level) from the given results; prioritize signals such as entry points, routes, services/use cases, and hot nodes. Output an executable "feature-level" checklist, do not generalize to "tools/libraries".',
        jsonOutput: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to identify core features');
      }

      return safeJsonParse(result.content);
    } catch (error) {
      console.error('Error in runTask3_identifyCoreFeatures:', error);
      throw new Error(`Task 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 执行LLM智能分析 - 使用LangChain Chain重构
  private async performLLMAnalysis(
    repositoryUrl: string,
    onProgress?: (progress: AnalysisProgress) => void,
  ): Promise<boolean> {
    try {
      onProgress?.({ stage: 'AI智能分析-生成项目概览', progress: 30 });
      const overview = await this.runTask1_generateOverview();
      onProgress?.({ stage: 'AI智能分析-分析项目依赖', progress: 40 });
      const dependencies = await this.runTask2_analyzeDependencies(overview);
      onProgress?.({ stage: 'AI智能分析-识别核心功能', progress: 50 });
      const features = await this.runTask3_identifyCoreFeatures(overview, dependencies);
      // 1. 创建计划 (使用Agent)
      onProgress?.({ stage: 'AI智能分析-制定分析计划', progress: 60 });
      const agent = new Agent(this.config.llmConfig, this.basePath);
      const plannerResult = await agent.execute({
        actionPrompt: `Please review the current codebase and compile a corresponding documentation plan. 
        You may leverage tools during this process to perform necessary operations such as querying project structures and examining source code.`,
        rolePrompt: PromptBuilder.SYSTEM_PROMPT_PLANNER,
        rolePromptParams: {
          Project_Overview: JSON.stringify(overview),
          DependencyGraph: JSON.stringify(dependencies),
          CoreFeatures: JSON.stringify(features),
          Output_Example: PromptBuilder.SYSTEM_PROMPT_SCHEDULER_JSON,
        },
        withEnv: true, // withEnv is important to give context to the agent
      });

      if (!plannerResult.success) {
        throw new Error(`Failed to create analysis plan: ${plannerResult.error}`);
      }
      const plan = plannerResult.content;

      // 2. 创建任务调度链
      onProgress?.({ stage: 'AI智能分析-分解分析任务', progress: 70 });
      console.log('------plan', plan);
      const schedulerResult = await agent.execute({
        // actionPrompt: `请根据以下文档编写计划来生成一份文档编写任务列表，以下是具体的计划
        actionPrompt: `Based on the following documentation plan, please generate a comprehensive list of documentation tasks. Below are the specific plan details.
------------------------------
{plan}`,
        actionPromptParams: { plan },
        rolePrompt: PromptBuilder.SYSTEM_PROMPT_SCHEDULER,
        rolePromptParams: { json: PromptBuilder.SYSTEM_PROMPT_SCHEDULER_JSON },
        jsonOutput: true, // Ensure JSON output
        withEnv: false,
        withTools: false,
      });

      if (!schedulerResult.success) {
        throw new Error(`Failed to create task list: ${schedulerResult.error}`);
      }

      const tasksResult = JSON.parse(schedulerResult.content);
      console.log('-----tasksResult', tasksResult);
      const taskList = (tasksResult as any).document_tasks;

      if (Array.isArray(taskList)) {
        const repositoryUrlEncoded = repositoryUrl.replaceAll('http://', '').replaceAll('https://', '');
        taskList.unshift({
          // title: 'overview',
          // goal: '对当前项目进行简要介绍',
          // outline: '按当前项目内容自由发挥',
          // targetReader: '项目的目标用户',
          title: 'Overview',
          goal: 'Provide a concise introduction to the current project',
          outline: "Flexibly structure based on the project's actual content",
          targetReader: "The project's intended audience",
        });
        const cnTitleList = (await this.translator(taskList.map((t) => t.title).join(','))).split(',');
        // 3. 并行执行所有文档编写任务 (使用重构后的Agent)
        let countProgress = 0;
        const writePromises = taskList.map(async (task, index) => {
          try {
            const result = await this.writer(task);
            const cnResult = await this.translator(result);
            await DocsManager.saveDoc(repositoryUrlEncoded, task.title.replaceAll(' ', ''), result, Language.EN);
            await DocsManager.saveDoc(
              repositoryUrlEncoded,
              cnTitleList[index].replaceAll(' ', ''),
              cnResult,
              Language.ZH_CN,
            );
            countProgress += 1;
            onProgress?.({
              stage: 'AI智能分析-编写分析文档',
              progress: 80 + Math.floor(((countProgress + 1) / taskList.length) * 20),
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
        const outlineCN = cnTitleList
          .map((title) => {
            return `- [${title}](${title.replaceAll(' ', '')}.md)`;
          })
          .join('\n\n');
        const sidebar = `<!-- docs/_sidebar.md -->\n${outline}`;
        const cnSidebar = `<!-- docs/_sidebar.md -->\n${outlineCN}`;
        await DocsManager.saveDoc(repositoryUrlEncoded, '_sidebar', sidebar, Language.EN);
        await DocsManager.saveDoc(repositoryUrlEncoded, '_sidebar', cnSidebar, Language.ZH_CN);

        await DocsManager.publishDocs(repositoryUrlEncoded);

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
      await progressManager.delete(repositoryUrl);
      return false;
    }
  }

  // 执行具体编写任务 - 此方法保持不变，因为它需要一个具备工具使用能力的完整Agent
  private async writer(task: { title: string; goal: string; outline: string; targetReader: string }) {
    // const actionPrompt = `结合当前仓库中的代码，根据以下要求来编写一篇文档
    // ------------------------------
    // ## 标题
    // {title}
    // ## 写作目标
    // {goal}
    // ## 大纲:
    // \`\`\`
    // {outline}
    // \`\`\`
    // ## 目标读者
    // {targetReader}
    // `;
    const actionPrompt = `Leverage the current repository's source code to author documentation according to the following specifications:
-----------------------------------
## Title
{title}
## Writing Objectives
{goal}
## Outline:
\`\`\`
{outline}
\`\`\`
## Target Audience
{targetReader}`;

    const result = await this.agent.execute({
      actionPrompt,
      actionPromptParams: { ...task },
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_WRITER,
      rolePromptParams: { json: PromptBuilder.SYSTEM_PROMPT_WRITER_JSON },
      jsonOutput: true,
      withEnv: true,
    });
    if (!result.success) {
      throw new Error(`Failed to create doc ${task.title}: ${result.error}`);
    }

    const docResult = JSON.parse(result.content);
    console.log('-----docResult', docResult);
    return (docResult as any).document;
  }

  private async translator(content: string): Promise<string> {
    const actionPrompt = `
    Please translate the following content
    -----------------------------------
  {content}
    `;
    const agent = new Agent(this.config.llmConfig, this.basePath);
    const result = await agent.execute({
      actionPrompt,
      actionPromptParams: { content },
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_TRANS_TO_CHINESE,
      rolePromptParams: {
        json: PromptBuilder.SYSTEM_PROMPT_WRITER_JSON,
        example: PromptBuilder.SYSTEM_PROMPT_TRANS_TO_CHINESE_EXP,
      },
      jsonOutput: true,
      withEnv: false,
      withTools: false,
    });
    if (!result.success) {
      throw new Error(`Failed to trans doc to : ${result.error}`);
    }

    const docResult = JSON.parse(result.content);
    console.log('-----docResult', docResult);
    return (docResult as any).document;
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
export function createAnalysisOrchestrator(config: AnalysisConfig, repositoryPath: string) {
  return new AnalysisOrchestrator(config, repositoryPath);
}
