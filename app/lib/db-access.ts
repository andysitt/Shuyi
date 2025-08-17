import prisma from '@/app/lib/db';
import {
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
} from '@/app/types';

// AnalysisResult接口
export interface IAnalysisResult {
  id: number;
  repositoryUrl: string;
  owner: string;
  repo: string;
  metadata: RepositoryMetadata;
  structure: RepositoryStructure;
  dependencies: DependencyInfo[];
  codeQuality: CodeQualityMetrics;
  llmInsights: any;
  createdAt: Date;
  updatedAt: Date;
  status: string;
}

// AnalysisProgress接口 (Redis-based)
export interface IAnalysisProgress {
  id: string; // Analysis ID (Base64 encoded URL)
  repositoryUrl: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  details: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export class DatabaseAccess {
  // --- Analysis Result Methods (PostgreSQL) ---
  static async saveAnalysisResult(result: {
    repositoryUrl: string;
    owner: string;
    repo: string;
    metadata: RepositoryMetadata;
    structure: RepositoryStructure;
    dependencies: DependencyInfo[];
    codeQuality: CodeQualityMetrics;
    llmInsights: string;
    status: 'completed' | 'failed';
  }): Promise<IAnalysisResult> {
    const {
      repositoryUrl,
      owner,
      repo,
      metadata,
      structure,
      dependencies,
      codeQuality,
      llmInsights,
      status,
    } = result;

    const analysisResult = await prisma.analysisResult.upsert({
      where: { repository_url: repositoryUrl },
      update: {
        owner,
        repo,
        metadata: metadata as any,
        structure: structure as any,
        dependencies: dependencies as any,
        code_quality: codeQuality as any,
        llm_insights: { result: llmInsights } as any,
        status,
      },
      create: {
        repository_url: repositoryUrl,
        owner,
        repo,
        metadata: metadata as any,
        structure: structure as any,
        dependencies: dependencies as any,
        code_quality: codeQuality as any,
        llm_insights: { result: llmInsights } as any,
        status,
      },
    });

    return this.mapAnalysisResult(analysisResult);
  }

  static async getAnalysisResult(
    repositoryUrl: string,
  ): Promise<IAnalysisResult | null> {
    const analysisResult = await prisma.analysisResult.findUnique({
      where: { repository_url: repositoryUrl },
    });

    if (!analysisResult) {
      return null;
    }

    return this.mapAnalysisResult(analysisResult);
  }

  static async getAnalysisResultById(
    id: number,
  ): Promise<IAnalysisResult | null> {
    const analysisResult = await prisma.analysisResult.findUnique({
      where: { id },
    });

    if (!analysisResult) {
      return null;
    }

    return this.mapAnalysisResult(analysisResult);
  }

  static async getAllAnalysisResults(): Promise<IAnalysisResult[]> {
    const analysisResults = await prisma.analysisResult.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    return analysisResults.map(this.mapAnalysisResult);
  }

  private static mapAnalysisResult(row: any): IAnalysisResult {
    return {
      id: row.id,
      repositoryUrl: row.repository_url,
      owner: row.owner,
      repo: row.repo,
      metadata: row.metadata,
      structure: row.structure,
      dependencies: row.dependencies,
      codeQuality: row.code_quality,
      llmInsights: row.llm_insights,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    };
  }
}
