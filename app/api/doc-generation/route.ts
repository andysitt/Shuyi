import { NextResponse } from 'next/server';
import { DocGenerationOrchestrator } from '@/app/service/doc-generation-orchestrator';
import { AnalysisConfig, AnalysisProgress } from '@/app/types';
import { TempManager } from '@/app/lib/temp-manager';
import { GitHubClient } from '@/app/lib/github-client';
import { progressManager } from '@/app/service/progress-manager';

export async function POST(request: Request) {
  try {
    const { repositoryUrl } = await request.json();
    const githubClient = new GitHubClient();
    const validation = await githubClient.validateRepository(repositoryUrl);
    if (!validation.isValid) {
      await progressManager.update(repositoryUrl, {
        status: 'failed',
        details: validation.error,
      });
      return;
    }

    const { owner, repo } = validation;
    if (!repositoryUrl) {
      return NextResponse.json({ error: 'repositoryUrl is required' }, { status: 400 });
    }

    const tempManager = new TempManager();
    const repositoryPath = await tempManager.createTempDir(`${owner}|${repo}`);

    try {
      // await simpleGit().clone(`${repositoryUrl}.git`, repositoryPath);
      await githubClient.cloneRepository(repositoryUrl, repositoryPath);
    } catch (error) {
      await tempManager.cleanupTempDirectory(repositoryPath);
      console.error('Error cloning repository:', error);
      return NextResponse.json({ error: 'Failed to clone repository' }, { status: 500 });
    }

    if (!process.env.LLM_API_KEY) {
      return NextResponse.json({ error: 'LLM_API_KEY is not configured' }, { status: 500 });
    }

    const config: AnalysisConfig = {
      llmConfig: {
        provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'custom',
        apiKey: process.env.LLM_API_KEY.split(',').map((k) => k.trim()),
        model: process.env.LLM_MODEL || 'gpt-4-turbo-preview',
        baseURL: process.env.LLM_BASE_URL || undefined,
        temperature: 0.6,
      },
      analysisType: 'documentation',
    };

    const orchestrator = new DocGenerationOrchestrator(config, repositoryPath, repositoryUrl);

    const onProgress = (progress: AnalysisProgress) => {
      progressManager.update(repositoryUrl, progress);
    };

    // Execute asynchronously without awaiting
    orchestrator
      .execute(repositoryUrl, onProgress)
      .catch(async (error) => {
        console.error(`Error executing documentation generation for ${repositoryUrl}:`, error);
        await progressManager.update(repositoryUrl, { stage: 'Error', progress: 0, details: error.message });
      })
      .finally(() => {
        // tempManager.cleanup();
      });

    return NextResponse.json({ message: 'Documentation generation started' }, { status: 202 });
  } catch (error) {
    console.error('Error in doc-generation API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
