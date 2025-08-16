import { cacheManager } from '../lib/cache-manager';

export interface IAnalysisProgress {
  id: string;
  repositoryUrl: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  details: string;
  createdAt: string;
  updatedAt: string;
}

const ANALYSIS_PROGRESS_TTL = 24 * 60 * 60; // 24 hours

class ProgressManager {
  private getProgressKey(repositoryUrl: string): string {
    const encodedUrl = Buffer.from(repositoryUrl).toString('base64');
    return `progress:${encodedUrl}`;
  }

  async create(repositoryUrl: string): Promise<IAnalysisProgress> {
    const id = Buffer.from(repositoryUrl).toString('base64');
    const now = new Date().toISOString();
    const newProgress: IAnalysisProgress = {
      id,
      repositoryUrl,
      status: 'pending',
      progress: 0,
      stage: 'Initializing',
      details: 'Initializing analysis...',
      createdAt: now,
      updatedAt: now,
    };

    const key = this.getProgressKey(repositoryUrl);
    await cacheManager.set(key, newProgress, ANALYSIS_PROGRESS_TTL);
    return newProgress;
  }

  async update(
    repositoryUrl: string,
    updates: Partial<Omit<IAnalysisProgress, 'id' | 'createdAt'>>,
  ): Promise<IAnalysisProgress | null> {
    const key = this.getProgressKey(repositoryUrl);
    const existing = await this.get(repositoryUrl);

    if (!existing) {
      return null;
    }

    const updatedProgress: IAnalysisProgress = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await cacheManager.set(key, updatedProgress, ANALYSIS_PROGRESS_TTL);
    return updatedProgress;
  }

  async get(repositoryUrl: string): Promise<IAnalysisProgress | null> {
    const key = this.getProgressKey(repositoryUrl);
    return cacheManager.get<IAnalysisProgress>(key);
  }

  async delete(repositoryUrl: string): Promise<void> {
    const key = this.getProgressKey(repositoryUrl);
    await cacheManager.del(key);
  }
}

export const progressManager = new ProgressManager();
