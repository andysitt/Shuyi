// app/lib/platform-client.ts
import { GitHubClient } from '@/app/lib/github-client';
import { GitLabClient } from '@/app/lib/gitlab-client';
import { RepositoryMetadata } from '@/app/types';
import { getGitHubConfig, getGitLabConfig } from '@/app/lib/config';

export interface CodePlatformClient {
  validateRepository(url: string): Promise<{
    isValid: boolean;
    error?: string;
    [key: string]: any;
  }>;

  getRepositoryMetadata(...args: any[]): Promise<RepositoryMetadata>;

  getFileContent(...args: any[]): Promise<string>;

  downloadRepository(...args: any[]): Promise<string>;
}

export class PlatformFactory {
  static createClient(platform: 'github' | 'gitlab'): CodePlatformClient {
    switch (platform) {
      case 'github':
        const githubConfig = getGitHubConfig();
        return new GitHubClient(githubConfig.token);

      case 'gitlab':
        const gitlabConfig = getGitLabConfig();
        return new GitLabClient(gitlabConfig.token, gitlabConfig.host);

      default:
        throw new Error('Unsupported platform');
    }
  }
}

export async function detectPlatform(url: string): Promise<'github' | 'gitlab' | 'unknown'> {
  try {
    const response = await fetch('/api/platform/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const result = await response.json();
      
      // 如果验证成功，直接使用API返回的平台信息
      if (result.isValid && result.platform) {
        return result.platform;
      }
    }
    
    // 如果API调用失败或验证不通过，回退到基于URL模式的检测
    if (url.includes('github.com')) return 'github';
    
    const gitlabConfig = getGitLabConfig();
    const gitlabHost = gitlabConfig.host.replace(/^https?:\/\//, '');
    if (gitlabHost && url.includes(gitlabHost)) return 'gitlab';
    
    if (url.match(/gitlab\.[^\/]+/)) return 'gitlab';
    
    return 'unknown';
  } catch (error) {
    // API调用失败时回退到基于URL模式的检测
    if (url.includes('github.com')) return 'github';
    
    const gitlabConfig = getGitLabConfig();
    const gitlabHost = gitlabConfig.host.replace(/^https?:\/\//, '');
    if (gitlabHost && url.includes(gitlabHost)) return 'gitlab';
    
    if (url.match(/gitlab\.[^\/]+/)) return 'gitlab';
    
    return 'unknown';
  }
}

export async function parseRepositoryIdentifier(url: string): Promise<{
  platform: 'github' | 'gitlab' | 'unknown';
  identifier: string | { owner: string; repo: string } | { projectId: number; projectPath: string } | null;
}> {
  const platform = await detectPlatform(url);

  switch (platform) {
    case 'github':
      const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (githubMatch) {
        const [, owner, repo] = githubMatch;
        const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');
        return {
          platform: 'github',
          identifier: { owner, repo: cleanRepo },
        };
      }
      break;

    case 'gitlab':
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
        if (pathname.split('/').length >= 2) {
          return {
            platform: 'gitlab',
            identifier: pathname,
          };
        }
      } catch (error) {
        // URL解析失败
      }
      break;
  }

  return {
    platform: 'unknown',
    identifier: null,
  };
}
