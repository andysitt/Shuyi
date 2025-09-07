// app/api/platform/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PlatformFactory, detectPlatform } from '@/app/lib/platform-client';
import fs from 'fs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const ref = searchParams.get('ref') || 'main';

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const platform = await detectPlatform(url);
    
    if (platform === 'unknown') {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    const client = PlatformFactory.createClient(platform);
    const identifier = await getRepositoryIdentifier(url, platform);
    const zipPath = await client.downloadRepository(...(Array.isArray(identifier) ? [...identifier, ref] : [identifier, ref]));

    // 设置响应头
    const filename = `repository-${Date.now()}.zip`;
    const headers = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    };

    // 读取文件并返回
    const fileBuffer = fs.readFileSync(zipPath);
    
    // 清理临时文件
    fs.unlinkSync(zipPath);

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function getRepositoryIdentifier(url: string, platform: string): Promise<any> {
  // 根据平台类型解析标识符
  switch (platform) {
    case 'github':
      const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (githubMatch) {
        const [, owner, repo] = githubMatch;
        const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');
        return [owner, cleanRepo]; // 返回数组格式 [owner, repo]
      }
      break;
      
    case 'gitlab':
      // 对于GitLab，先验证项目获取项目ID或路径
      try {
        const client = PlatformFactory.createClient(platform);
        const validationResult = await client.validateRepository(url);
        
        if (validationResult.isValid) {
          // 优先使用项目ID，如果没有则使用项目路径
          return validationResult.projectId || validationResult.projectPath || url;
        }
      } catch (error) {
        // 验证失败时回退到URL路径提取
        console.warn('GitLab验证失败，使用URL路径:', error);
      }
      
      // 从URL中提取项目路径
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');
        if (pathname.split('/').length >= 2) {
          return pathname;
        }
      } catch (error) {
        console.warn('URL解析失败:', error);
      }
      
      return url;
  }
  
  throw new Error('Invalid repository URL');
}