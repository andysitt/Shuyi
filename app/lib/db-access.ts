import { QueryResult } from 'pg';
import { connectToDatabase, query } from '@/app/lib/db';
import redisClient from '@/app/lib/redis-client';
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
  llmInsights: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'completed' | 'failed';
}

// AnalysisProgress接口 (Redis-based)
export interface IAnalysisProgress {
  id: string; // Analysis ID
  repositoryUrl: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  details: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

const ANALYSIS_PROGRESS_TTL = 24 * 60 * 60; // 24 hours

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
    await connectToDatabase();

    const text = `
      INSERT INTO analysis_results(
        repository_url, owner, repo, metadata, structure, dependencies, code_quality, llm_insights, status, created_at, updated_at
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (repository_url) 
      DO UPDATE SET
        owner = EXCLUDED.owner,
        repo = EXCLUDED.repo,
        metadata = EXCLUDED.metadata,
        structure = EXCLUDED.structure,
        dependencies = EXCLUDED.dependencies,
        code_quality = EXCLUDED.code_quality,
        llm_insights = EXCLUDED.llm_insights,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      result.repositoryUrl,
      result.owner,
      result.repo,
      JSON.stringify(result.metadata),
      JSON.stringify(result.structure),
      JSON.stringify(result.dependencies),
      JSON.stringify(result.codeQuality),
      JSON.stringify({ result: result.llmInsights }),
      result.status,
    ];

    const res: QueryResult = await query(text, values);
    return this.mapAnalysisResultRow(res.rows[0]);
  }

  static async getAnalysisResult(
    repositoryUrl: string
  ): Promise<IAnalysisResult | null> {
    await connectToDatabase();

    const text = 'SELECT * FROM analysis_results WHERE repository_url = $1';
    const values = [repositoryUrl];

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisResultRow(res.rows[0]);
  }

  static async getAnalysisResultById(
    id: number
  ): Promise<IAnalysisResult | null> {
    await connectToDatabase();

    const text = 'SELECT * FROM analysis_results WHERE id = $1';
    const values = [id];

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisResultRow(res.rows[0]);
  }

  static async getAllAnalysisResults(): Promise<IAnalysisResult[]> {
    await connectToDatabase();

    const text = 'SELECT * FROM analysis_results ORDER BY created_at DESC';
    const res: QueryResult = await query(text);

    return res.rows.map((row) => this.mapAnalysisResultRow(row));
  }

  private static mapAnalysisResultRow(row: any): IAnalysisResult {
    return {
      id: row.id,
      repositoryUrl: row.repository_url,
      owner: row.owner,
      repo: row.repo,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
      structure:
        typeof row.structure === 'string'
          ? JSON.parse(row.structure)
          : row.structure,
      dependencies:
        typeof row.dependencies === 'string'
          ? JSON.parse(row.dependencies)
          : row.dependencies,
      codeQuality:
        typeof row.code_quality === 'string'
          ? JSON.parse(row.code_quality)
          : row.code_quality,
      llmInsights:
        typeof row.llm_insights === 'string'
          ? JSON.parse(row.llm_insights)
          : row.llm_insights,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    };
  }

  // --- Analysis Progress Methods (Redis) ---

  private static getProgressKey(id: string): string {
    return `progress:${id}`;
  }

  private static getUrlToIdKey(url: string): string {
    const encodedUrl = Buffer.from(url).toString('base64');
    return `url-to-id:${encodedUrl}`;
  }

  static async createAnalysisProgress(progress: {
    id: string;
    repositoryUrl: string;
    status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    progress?: number;
    stage: string;
    details?: string;
  }): Promise<IAnalysisProgress> {
    const now = new Date().toISOString();
    const newProgress: IAnalysisProgress = {
      id: progress.id,
      repositoryUrl: progress.repositoryUrl,
      status: progress.status || 'pending',
      progress: progress.progress || 0,
      stage: progress.stage,
      details: progress.details || '',
      createdAt: now,
      updatedAt: now,
    };

    const progressKey = this.getProgressKey(progress.id);
    const urlToIdKey = this.getUrlToIdKey(progress.repositoryUrl);

    const multi = redisClient.multi();
    multi.set(progressKey, JSON.stringify(newProgress), { EX: ANALYSIS_PROGRESS_TTL });
    multi.set(urlToIdKey, progress.id, { EX: ANALYSIS_PROGRESS_TTL });
    await multi.exec();

    return newProgress;
  }

  static async getAnalysisProgressById(
    id: string
  ): Promise<IAnalysisProgress | null> {
    const key = this.getProgressKey(id);
    const data = await redisClient.get(key);

    if (!data) {
      return null;
    }

    const progress = JSON.parse(data) as IAnalysisProgress;

    // Refresh the TTL on both keys to keep them in sync
    const urlToIdKey = this.getUrlToIdKey(progress.repositoryUrl);
    const multi = redisClient.multi();
    multi.expire(key, ANALYSIS_PROGRESS_TTL);
    multi.expire(urlToIdKey, ANALYSIS_PROGRESS_TTL);
    await multi.exec();

    return progress;
  }

  static async getAnalysisProgressByUrl(
    url: string
  ): Promise<IAnalysisProgress | null> {
    const urlToIdKey = this.getUrlToIdKey(url);
    const analysisId = await redisClient.get(urlToIdKey);

    if (!analysisId) {
      return null;
    }
    return this.getAnalysisProgressById(analysisId);
  }

  static async updateAnalysisProgress(
    id: string,
    updates: Partial<Omit<IAnalysisProgress, 'id' | 'createdAt'>>
  ): Promise<IAnalysisProgress | null> {
    const key = this.getProgressKey(id);
    // Note: getAnalysisProgressById also refreshes TTL, which is fine for an update.
    const existing = await this.getAnalysisProgressById(id);

    if (!existing) {
      return null;
    }

    const updatedProgress: IAnalysisProgress = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await redisClient.set(key, JSON.stringify(updatedProgress), {
      EX: ANALYSIS_PROGRESS_TTL,
    });

    return updatedProgress;
  }

  static async deleteAnalysisProgress(id: string): Promise<void> {
    const progressKey = this.getProgressKey(id);
    const rawData = await redisClient.get(progressKey);

    const multi = redisClient.multi();
    multi.del(progressKey);

    if (rawData) {
      const progress = JSON.parse(rawData) as IAnalysisProgress;
      const urlToIdKey = this.getUrlToIdKey(progress.repositoryUrl);
      multi.del(urlToIdKey);
    }
    
    await multi.exec();
  }
}
