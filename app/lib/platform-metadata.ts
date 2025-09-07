import { RepositoryMetadata } from '@/app/types';

/**
 * 在客户端检测平台类型，使用API接口验证
 */
export async function detectPlatformUrl(url: string): Promise<'github' | 'gitlab' | 'unknown'> {
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
    
    if (url.match(/gitlab\.[^\/]+/)) return 'gitlab';
    
    if (url.includes('gitlab') && !url.includes('github')) return 'gitlab';
    
    return 'unknown';
  } catch (error) {
    // API调用失败时回退到基于URL模式的检测
    if (url.includes('github.com')) return 'github';
    
    if (url.match(/gitlab\.[^\/]+/)) return 'gitlab';
    
    if (url.includes('gitlab') && !url.includes('github')) return 'gitlab';
    
    return 'unknown';
  }
}

/**
 * 根据仓库URL获取元数据
 * @param url 仓库URL
 * @returns 平台类型、标识符和元数据
 */
export async function fetchRepositoryMetadata(url: string): Promise<{
  platform: 'github' | 'gitlab' | 'unknown';
  metadata: RepositoryMetadata | null;
  error?: string;
}> {
  try {
    const platform = await detectPlatformUrl(url);
    console.log('---------', platform);
    if (platform === 'unknown') {
      return { platform, metadata: null, error: '不支持的代码托管平台' };
    }

    // 使用统一的元数据接口
    const response = await fetch(`/api/platform/metadata?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      const errorData = await response.json();
      return {
        platform,
        metadata: null,
        error: errorData.error || '获取元数据失败',
      };
    }

    const metadata = await response.json();

    // 构建统一的URL格式
    let repoUrl = url;
    if (platform === 'github') {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        const [, owner, repo] = match;
        repoUrl = `https://github.com/${owner}/${repo}`;
      }
    } else if (platform === 'gitlab') {
      // GitLab URL已经通过验证，确保格式一致
      repoUrl = url.replace(/\/$/, ''); // 移除尾部斜杠
    }

    // 添加或更新URL字段（如果后端没有提供）
    if (metadata && !metadata.url) {
      metadata.url = repoUrl;
    }

    return {
      platform,
      metadata,
    };
  } catch (error) {
    console.error('获取仓库元数据失败:', error);
    return {
      platform: await detectPlatformUrl(url),
      metadata: null,
      error: error instanceof Error ? error.message : '获取元数据失败',
    };
  }
}

/**
 * 解析仓库URL获取基本信息
 */
export async function parseRepositoryInfo(url: string): Promise<{
  owner: string;
  repo: string;
  url: string;
  platform: 'github' | 'gitlab' | 'unknown';
}> {
  const platform = await detectPlatformUrl(url);

  if (platform === 'github') {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const [, owner, repo] = match;
      return {
        owner,
        repo: repo.replace(/\.git$/, ''),
        url: `https://github.com/${owner}/${repo}`,
        platform,
      };
    }
  } else if (platform === 'gitlab') {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname) {
        // 获取项目的最后一部分作为repo名称
        const parts = pathname.split('/');
        const repo = parts[parts.length - 1];
        return {
          owner: parts.slice(0, -1).join('/'),
          repo: repo.replace(/\.git$/, ''),
          url: url.replace(/\/$/, ''),
          platform,
        };
      }
    } catch (error) {
      console.error('解析GitLab URL失败:', error);
    }
  }

  return {
    owner: 'unknown',
    repo: 'unknown',
    url: url,
    platform,
  };
}
