import { QueryResult } from "pg";
import { connectToDatabase, query } from "@/app/lib/db";
import {
  RepositoryMetadata,
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
  LLMInsights,
} from "@/app/types";

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
  status: "completed" | "failed";
}

// AnalysisProgress接口
export interface IAnalysisProgress {
  id: number;
  repositoryUrl: string;
  status: "pending" | "analyzing" | "completed" | "failed";
  progress: number;
  stage: string;
  details: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseAccess {
  static async saveAnalysisResult(result: {
    repositoryUrl: string;
    owner: string;
    repo: string;
    metadata: RepositoryMetadata;
    structure: RepositoryStructure;
    dependencies: DependencyInfo[];
    codeQuality: CodeQualityMetrics;
    llmInsights: string;
    status: "completed" | "failed";
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

    const text = "SELECT * FROM analysis_results WHERE repository_url = $1";
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

    const text = "SELECT * FROM analysis_results WHERE id = $1";
    const values = [id];

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisResultRow(res.rows[0]);
  }

  static async getAllAnalysisResults(): Promise<IAnalysisResult[]> {
    await connectToDatabase();

    const text = "SELECT * FROM analysis_results ORDER BY created_at DESC";
    const res: QueryResult = await query(text);

    return res.rows.map((row) => this.mapAnalysisResultRow(row));
  }

  static async saveAnalysisProgress(progress: {
    repositoryUrl: string;
    status?: "pending" | "analyzing" | "completed" | "failed";
    progress?: number;
    stage: string;
    details?: string;
  }): Promise<IAnalysisProgress> {
    await connectToDatabase();

    const text = `
      INSERT INTO analysis_progress(
        repository_url, status, progress, stage, details, created_at, updated_at
      ) VALUES($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (repository_url) 
      DO UPDATE SET
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        stage = EXCLUDED.stage,
        details = EXCLUDED.details,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      progress.repositoryUrl,
      progress.status || "pending",
      progress.progress || 0,
      progress.stage,
      progress.details || null,
    ];

    const res: QueryResult = await query(text, values);
    return this.mapAnalysisProgressRow(res.rows[0]);
  }

  static async getAnalysisProgress(
    repositoryUrl: string
  ): Promise<IAnalysisProgress | null> {
    await connectToDatabase();

    const text = "SELECT * FROM analysis_progress WHERE repository_url = $1";
    const values = [repositoryUrl];

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisProgressRow(res.rows[0]);
  }

  static async getAnalysisProgressById(
    id: number
  ): Promise<IAnalysisProgress | null> {
    await connectToDatabase();

    const text = "SELECT * FROM analysis_progress WHERE id = $1";
    const values = [id];

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisProgressRow(res.rows[0]);
  }

  static async updateAnalysisProgress(
    id: number,
    updates: Partial<IAnalysisProgress>
  ): Promise<IAnalysisProgress | null> {
    await connectToDatabase();

    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${index++}`);
      values.push(updates.status);
    }

    if (updates.progress !== undefined) {
      fields.push(`progress = $${index++}`);
      values.push(updates.progress);
    }

    if (updates.stage !== undefined) {
      fields.push(`stage = $${index++}`);
      values.push(updates.stage);
    }

    if (updates.details !== undefined) {
      fields.push(`details = $${index++}`);
      values.push(updates.details);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const text = `
      UPDATE analysis_progress 
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *;
    `;

    const res: QueryResult = await query(text, values);
    if (res.rows.length === 0) {
      return null;
    }

    return this.mapAnalysisProgressRow(res.rows[0]);
  }

  static async createAnalysisProgress(progress: {
    repositoryUrl: string;
    status?: "pending" | "analyzing" | "completed" | "failed";
    progress?: number;
    stage: string;
    details?: string;
  }): Promise<IAnalysisProgress> {
    await connectToDatabase();

    const text = `
      INSERT INTO analysis_progress(
        repository_url, status, progress, stage, details, created_at, updated_at
      ) VALUES($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *;
    `;

    const values = [
      progress.repositoryUrl,
      progress.status || "pending",
      progress.progress || 0,
      progress.stage,
      progress.details || null,
    ];

    const res: QueryResult = await query(text, values);
    return this.mapAnalysisProgressRow(res.rows[0]);
  }

  static async deleteAnalysisProgress(repositoryUrl: string): Promise<void> {
    await connectToDatabase();

    const text = "DELETE FROM analysis_progress WHERE repository_url = $1";
    const values = [repositoryUrl];

    await query(text, values);
  }

  // 映射数据库行到AnalysisResult对象
  private static mapAnalysisResultRow(row: any): IAnalysisResult {
    return {
      id: row.id,
      repositoryUrl: row.repository_url,
      owner: row.owner,
      repo: row.repo,
      metadata:
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata,
      structure:
        typeof row.structure === "string"
          ? JSON.parse(row.structure)
          : row.structure,
      dependencies:
        typeof row.dependencies === "string"
          ? JSON.parse(row.dependencies)
          : row.dependencies,
      codeQuality:
        typeof row.code_quality === "string"
          ? JSON.parse(row.code_quality)
          : row.code_quality,
      llmInsights:
        typeof row.llm_insights === "string"
          ? JSON.parse(row.llm_insights)
          : row.llm_insights,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    };
  }

  // 映射数据库行到AnalysisProgress对象
  private static mapAnalysisProgressRow(row: any): IAnalysisProgress {
    return {
      id: row.id,
      repositoryUrl: row.repository_url,
      status: row.status,
      progress: row.progress,
      stage: row.stage,
      details: row.details,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
