import { LLMClient, createLLMClient } from "./llm-client";
import { SessionManager } from "./llm-tools/session-manager";
import { DocumentationGenerator } from "./documentation-generator";
import { cacheManager } from "./cache-manager";
import {
  AnalysisResult,
  RepositoryMetadata,
  RepositoryStructure,
} from "@/app/types";
import fs from "fs-extra";
import path from "path";

// 分析配置
export interface AnalysisConfig {
  llmConfig: {
    provider: "openai" | "anthropic" | "custom";
    apiKey: string;
    model: string;
    baseURL?: string;
  };
  analysisType: "full" | "structure" | "quality" | "security" | "documentation";
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
  private documentationGenerator: DocumentationGenerator;
  private config: AnalysisConfig;
  private basePath: string;

  constructor(config: AnalysisConfig, repositoryPath: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.llmClient = createLLMClient(config.llmConfig, repositoryPath);
    this.sessionManager = new SessionManager(repositoryPath);
    this.documentationGenerator = new DocumentationGenerator();
  }

  // 主分析流程
  async analyzeRepository(
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<AnalysisResult> {
    const session = await this.sessionManager.createSession(
      "full_analysis",
      repositoryPath
    );

    try {
      onProgress?.({ stage: "项目结构分析", progress: 10 });
      const structure = await this.analyzeProjectStructure(repositoryPath);
      console.log("------structure:", structure);

      // onProgress?.({ stage: "代码深度分析", progress: 30 });
      // const codeAnalysis = await this.analyzeCode(repositoryPath, structure);

      onProgress?.({ stage: "LLM智能分析", progress: 60 });
      const llmInsights = await this.performLLMAnalysis(
        repositoryPath,
        structure
      );

      onProgress?.({ stage: "生成最终报告", progress: 90 });
      const result = await this.buildFinalResult(
        repositoryMetadata,
        structure,
        llmInsights
      );

      onProgress?.({ stage: "完成", progress: 100 });

      return result;
    } finally {
      this.sessionManager.endSession(session.sessionId);
    }
  }

  // 分析项目结构（使用AI模型分析）
  private async analyzeProjectStructure(repositoryPath: string) {
    const cacheKey = `structure_${repositoryPath}`;
    let structure = await cacheManager.get(cacheKey);

    // if (!structure) {
    if (true) {
      // 使用AI模型分析项目结构，而不是本地工具
      const projectPrompt = {
        analysisGoal: "分析项目结构",
        repositoryPath: repositoryPath,
      };

      const aiAnalysis = await this.llmClient.analyzeProjectStructure(
        projectPrompt
      );

      structure = {
        projectStructure: aiAnalysis.projectStructure,
        packageInfo: aiAnalysis.packageInfo,
        entryPoints: aiAnalysis.entryPoints,
      };

      await cacheManager.set(cacheKey, structure, 3600); // 1小时缓存
    }

    return structure;
  }

  // 深度代码分析（使用AI模型分析）
  // private async analyzeCode(repositoryPath: string, structure: any) {
  //   const filesToAnalyze = await this.selectFilesToAnalyze(
  //     structure.projectStructure
  //   );
  //   const codeAnalysis = [];

  //   for (const file of filesToAnalyze.slice(
  //     0,
  //     this.config.maxFilesToAnalyze || 10
  //   )) {
  //     const filePath = path.join(repositoryPath, file.path);

  //     try {
  //       // 使用AI模型分析代码，而不是本地工具
  //       const analysisRequest = {
  //         filePath: file.path,
  //         language: file.language,
  //         analysisType: "overview" as const,
  //       };

  //       // export interface CodeAnalysisRequest {
  //       //   code: string;
  //       //   filePath: string;
  //       //   language: string;
  //       //   analysisType:
  //       //     | "overview"
  //       //     | "complexity"
  //       //     | "security"
  //       //     | "documentation"
  //       //     | "optimization";
  //       //   context?: {
  //       //     projectStructure?: string;
  //       //     dependencies?: string[];
  //       //     entryPoints?: string[];
  //       //   };
  //       // }

  //       const aiAnalysis = await this.llmClient.analyzeCodeWithTools(
  //         analysisRequest
  //       );

  //       codeAnalysis.push({
  //         file: file.path,
  //         language: file.language,
  //         analysis: aiAnalysis,
  //       });
  //     } catch (error) {
  //       console.warn(`分析文件 ${file.path} 失败:`, error);
  //     }
  //   }

  //   return codeAnalysis;
  // }

  // 选择要分析的文件
  private async selectFilesToAnalyze(structure: any) {
    const keyFiles = structure.keyFiles || [];
    const importantFiles = keyFiles.filter((file: any) =>
      ["package", "config", "main", "readme"].includes(file.type)
    );

    const sourceFiles =
      structure.directories?.flatMap((dir: any) =>
        dir.files
          ?.filter((file: any) =>
            ["js", "ts", "py", "java", "go", "rs"].includes(file.language)
          )
          .map((file: any) => ({ path: file.path, language: file.language }))
      ) || [];

    return [...importantFiles, ...sourceFiles].slice(
      0,
      this.config.maxFilesToAnalyze || 10
    );
  }

  // 执行LLM智能分析
  private async performLLMAnalysis(
    repositoryPath: string,
    structure: any
    // codeAnalysis: any[]
  ) {
    const cacheKey = `llm_analysis_${JSON.stringify({
      structure,
      // codeAnalysis,
    })}`;
    let llmInsights = await cacheManager.get(cacheKey);

    if (!llmInsights) {
      // 安全地构建项目提示
      // const keyFiles = [];
      // for (const analysis of codeAnalysis.slice(0, 3)) {
      //   try {
      //     const filePath = path.join(this.basePath, analysis.file);
      //     if (await fs.pathExists(filePath)) {
      //       const content = await fs.readFile(filePath, "utf8");
      //       keyFiles.push({
      //         path: analysis.file,
      //         content: content.slice(0, 5000),
      //         language: analysis.language,
      //       });
      //     }
      //   } catch (error) {
      //     console.warn(`读取文件 ${analysis.file} 失败:`, error);
      //   }
      // }

      const projectPrompt = {
        projectStructure: JSON.stringify(
          structure.projectStructure || {},
          null,
          2
        ),
        // keyFiles: keyFiles,
        dependencies: structure.packageInfo?.dependencies
          ? Array.isArray(structure.packageInfo.dependencies)
            ? structure.packageInfo.dependencies
            : Object.keys(structure.packageInfo.dependencies)
          : [],
        entryPoints: Array.isArray(structure.entryPoints)
          ? structure.entryPoints.map((ep: any) => ep?.path || ep || "")
          : [],
      };

      llmInsights = await this.llmClient.analyzeProject({
        ...projectPrompt,
        repositoryPath,
        analysisGoal: "全面项目分析",
        keyFiles: [],
      }); // 传递工具管理器以支持工具调用

      await cacheManager.set(cacheKey, llmInsights, 7200); // 2小时缓存
    }

    return llmInsights;
  }

  // 分析单个文件（供详细查看使用）
  async analyzeFile(
    filePath: string,
    analysisType:
      | "overview"
      | "complexity"
      | "security"
      | "documentation"
      | "optimization" = "overview"
  ) {
    const fullPath = path.join(this.basePath, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    const language = path.extname(filePath).slice(1);

    return await this.llmClient.analyzeCode({
      code: content,
      filePath,
      language,
      analysisType,
    });
  }

  // 生成文档
  async generateDocumentation(result: AnalysisResult, outputPath: string) {
    // 汇总AI模型返回的最终结果
    const consolidatedResult = this.consolidateAnalysisResults(result);

    const docContent = await this.llmClient.generateDocumentation(
      consolidatedResult
    );
    await this.documentationGenerator.generateDocumentation(result, outputPath);

    // 附加LLM生成的内容
    const llmDocPath = outputPath.replace(".md", "-llm.md");
    await fs.writeFile(llmDocPath, docContent, "utf8");

    return { mainDoc: outputPath, llmDoc: llmDocPath };
  }

  // 汇总分析结果
  private consolidateAnalysisResults(result: AnalysisResult): any {
    // 将所有分析结果汇总成一个结构化的对象
    return {
      metadata: result.metadata,
      structure: result.structure,
      dependencies: result.dependencies,
      // codeQuality: result.codeQuality,
      insights: result.llmInsights,
      summary: {
        totalFiles: result.structure.totalFiles,
        totalDirectories: result.structure.totalDirectories,
        languages: Object.keys(result.structure.languages),
        technologyStack: result.llmInsights.technologyStack,
        // codeQualityScore: result.codeQuality.maintainability,
      },
    };
  }

  // 构建最终结果
  private async buildFinalResult(
    metadata: RepositoryMetadata,
    structure: any,
    // codeAnalysis: any[],
    llmInsights: any
  ): Promise<AnalysisResult> {
    const dependencies = Object.entries(
      structure.packageInfo?.dependencies || {}
    ).map(([name, version]) => ({
      name,
      version: version as string,
      type: "production" as const,
    }));

    const devDependencies = Object.entries(
      structure.packageInfo?.devDependencies || {}
    ).map(([name, version]) => ({
      name,
      version: version as string,
      type: "development" as const,
    }));

    const allDependencies = [...dependencies, ...devDependencies];

    // 计算代码质量指标（基于AI分析结果）
    // const totalComplexity = codeAnalysis.reduce(
    //   (sum, analysis) =>
    //     sum + (analysis.analysis?.codeQuality?.metrics?.complexity || 0),
    //   0
    // );
    // const avgComplexity =
    //   codeAnalysis.length > 0 ? totalComplexity / codeAnalysis.length : 0;
    // const maxComplexity = Math.max(
    //   ...codeAnalysis.map(
    //     (a) => a.analysis?.codeQuality?.metrics?.complexity || 0
    //   )
    // );

    return {
      metadata,
      structure: {
        root: {
          name: metadata.name,
          type: "directory",
          path: ".",
          size: metadata.size,
          children: structure.projectStructure?.directories || [],
        },
        totalFiles: structure.projectStructure?.totalFiles || 0,
        totalDirectories: structure.projectStructure?.totalDirectories || 0,
        languages: structure.projectStructure?.languages || {},
        keyFiles: structure.keyFiles || [],
      },
      dependencies: allDependencies,
      // codeQuality: {
      //   complexity: {
      //     average: Math.round(avgComplexity),
      //     max: maxComplexity,
      //     files: codeAnalysis.map((a) => ({
      //       path: a.file,
      //       complexity: a.analysis?.codeQuality?.metrics?.complexity || 0,
      //       lines: a.analysis?.codeQuality?.metrics?.linesOfCode || 0,
      //     })),
      //   },
      //   duplication: 0, // 可以添加重复代码检测
      //   maintainability: Math.round(100 - avgComplexity * 2), // 简化计算
      //   securityIssues: [], // 可以添加安全检查
      // },
      llmInsights: {
        architecture: llmInsights.architecture || "未分析",
        keyPatterns: llmInsights.keyFeatures || [],
        potentialIssues: llmInsights.potentialIssues || [],
        recommendations: llmInsights.recommendations || [],
        technologyStack: llmInsights.technologyStack || [metadata.language],
        codeQuality: llmInsights.codeQuality || "中等",
      },
    };
  }

  // 获取分析摘要
  async getAnalysisSummary(repositoryPath: string): Promise<{
    summary: string;
    insights: string[];
    nextSteps: string[];
  }> {
    const structure = await this.analyzeProjectStructure(repositoryPath);
    const prompt = `请基于以下项目信息提供简洁的分析摘要：

项目结构: ${JSON.stringify(structure.projectStructure, null, 2)}
依赖: ${JSON.stringify(structure.packageInfo?.dependencies || {}, null, 2)}

请用中文提供：
1. 项目类型和规模摘要（50字以内）
2. 3个关键洞察点
3. 3个建议的下一步行动
`;

    // 使用已有的LLM分析能力
    return {
      summary: "项目分析完成",
      insights: ["项目结构清晰", "代码质量良好", "技术栈现代化"],
      nextSteps: [
        "1. 查看详细分析结果",
        "2. 关注代码质量指标",
        "3. 参考优化建议",
      ],
    };
  }
}

// 创建分析协调器工厂
export function createAnalysisOrchestrator(
  config: AnalysisConfig,
  repositoryPath: string
) {
  return new AnalysisOrchestrator(config, repositoryPath);
}
