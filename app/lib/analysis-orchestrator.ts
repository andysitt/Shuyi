import { LLMClient, createLLMClient } from "./llm-client";
import { SessionManager } from "./llm-tools/session-manager";
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
  private config: AnalysisConfig;
  private basePath: string;

  constructor(config: AnalysisConfig, repositoryPath: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.llmClient = createLLMClient(config.llmConfig, repositoryPath);
    this.sessionManager = new SessionManager(repositoryPath);
  }

  // 主分析流程
  async analyzeRepository(
    repositoryUrl: string,
    repositoryPath: string,
    repositoryMetadata: RepositoryMetadata,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<AnalysisResult> {
    const session = await this.sessionManager.createSession(
      "full_analysis",
      repositoryPath
    );

    try {
      onProgress?.({ stage: "AI 智能分析", progress: 30 });
      const llmInsights = await this.performLLMAnalysis(
        repositoryUrl,
        repositoryPath
      );

      onProgress?.({ stage: "生成最终报告", progress: 70 });
      const result = await this.buildFinalResult(
        repositoryMetadata,
        llmInsights
      );

      onProgress?.({ stage: "完成", progress: 100 });

      return result;
    } finally {
      this.sessionManager.endSession(session.sessionId);
    }
  }

  // 执行LLM智能分析
  private async performLLMAnalysis(
    repositoryPath: string,
    repositoryUrl: string
  ) {
    const cacheKey = `ai_analysis_${repositoryUrl}`;
    let llmInsights = await cacheManager.get(cacheKey);

    if (!llmInsights) {
      llmInsights = await this.llmClient.analyzeProject(); // 传递工具管理器以支持工具调用

      await cacheManager.set(cacheKey, llmInsights, 7200); // 2小时缓存
    }

    return llmInsights;
  }

  // 构建最终结果
  private async buildFinalResult(
    metadata: RepositoryMetadata,
    llmInsights: string
  ): Promise<AnalysisResult> {
    return {
      metadata,
      llmInsights,
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
