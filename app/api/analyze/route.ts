// app/api/analyze/route.ts (更新版本)
import { NextRequest, NextResponse } from 'next/server';
import { GitHubClient } from '@/app/lib/github-client';
import { GitLabClient } from '@/app/lib/gitlab-client';
import { AnalysisOrchestrator } from '@/app/service/analysis-orchestrator';
import { cacheManager } from '@/app/lib/cache-manager';
import { TempManager } from '@/app/lib/temp-manager';
import { DatabaseAccess } from '@/app/lib/db-access';
import { AnalysisRequest, AnalysisResult, RepositoryMetadata } from '@/app/types';
import { progressManager } from '@/app/service/progress-manager';
import { detectPlatform, parseRepositoryIdentifier } from '@/app/lib/platform-client';
import { getGitHubConfig, getGitLabConfig } from '@/app/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { repositoryUrl, analysisType = 'full' } = body;

    if (!repositoryUrl) {
      return NextResponse.json({ success: false, error: '仓库URL是必需的' }, { status: 400 });
    }

    const analysisId = Buffer.from(repositoryUrl).toString('base64');

    // 创建分析进度记录
    await progressManager.create(repositoryUrl);

    // 更新进度
    const updateProgress = async (progress: number, stage: string, details?: string) => {
      await progressManager.update(repositoryUrl, {
        progress,
        stage,
        details,
        status: 'analyzing',
      });
    };

    // 立即返回进度ID，让前端可以开始轮询
    // 使用setTimeout异步执行分析过程
    setTimeout(async () => {
      const tempManager = new TempManager();
      try {
        await updateProgress(5, '验证仓库', '正在验证仓库有效性...');

        // 检查缓存
        const cacheKey = `analysis:${repositoryUrl}:${analysisType}`;
        const cached = await cacheManager.get<AnalysisResult>(cacheKey);
        if (cached) {
          await updateProgress(100, '完成', '分析完成');
          await progressManager.update(repositoryUrl, {
            status: 'completed',
            progress: 100,
            stage: '完成',
            details: '分析完成',
          });

          // 保存到数据库
          const metadata = cached.metadata;
          const dbResult = {
            repositoryUrl,
            owner: metadata.owner,
            repo: metadata.name,
            metadata,
            structure: cached.structure,
            dependencies: cached.dependencies,
            codeQuality: cached.codeQuality,
            llmInsights: cached.llmInsights,
            status: 'completed' as const,
          };
          await DatabaseAccess.saveAnalysisResult(dbResult);

          return;
        }

        await updateProgress(10, '验证仓库', '正在验证仓库有效性...');

        // 检测平台类型
        const platform = await detectPlatform(repositoryUrl);
        if (platform === 'unknown') {
          await progressManager.update(repositoryUrl, {
            status: 'failed',
            details: '不支持的代码托管平台',
          });
          return;
        }

        let metadata: RepositoryMetadata;
        let owner: string;
        let repo: string;
        let tempDirName: string;

        if (platform === 'github') {
          // GitHub处理逻辑
          const githubClient = new GitHubClient(getGitHubConfig().token);
          const validation = await githubClient.validateRepository(repositoryUrl);

          if (!validation.isValid) {
            await progressManager.update(repositoryUrl, {
              status: 'failed',
              details: validation.error,
            });
            return;
          }

          const { owner: ghOwner, repo: ghRepo } = validation;
          owner = ghOwner!;
          repo = ghRepo!;
          tempDirName = `${owner}|${repo}`;

          await updateProgress(15, '获取元数据', '正在获取仓库元数据...');
          metadata = await githubClient.getRepositoryMetadata(owner, repo);
        } else {
          // GitLab处理逻辑
          const gitlabConfig = getGitLabConfig();
          const gitlabClient = new GitLabClient(gitlabConfig.token, gitlabConfig.host);
          const validation = await gitlabClient.validateRepository(repositoryUrl);

          if (!validation.isValid) {
            await progressManager.update(repositoryUrl, {
              status: 'failed',
              details: validation.error,
            });
            return;
          }

          const projectId = validation.projectId!;
          const projectPath = validation.projectPath!;
          owner = projectPath;
          repo = projectPath.split('/').pop() || 'unknown';
          tempDirName = `gitlab-${projectId}`;

          await updateProgress(15, '获取元数据', '正在获取项目元数据...');
          metadata = await gitlabClient.getRepositoryMetadata(projectId);
        }

        await updateProgress(20, '克隆仓库', '正在克隆仓库...');

        // 创建临时目录
        const tempDir = tempManager.createTempDir(tempDirName);

        try {
          // 克隆仓库
          if (platform === 'github') {
            const githubClient = new GitHubClient(getGitHubConfig().token);
            await githubClient.cloneRepository(repositoryUrl, tempDir);
          } else {
            const gitlabConfig = getGitLabConfig();
            const gitlabClient = new GitLabClient(gitlabConfig.token, gitlabConfig.host);
            await gitlabClient.cloneRepository(repositoryUrl, tempDir);
          }

          await updateProgress(30, '配置分析', '正在配置AI分析...');

          // 配置LLM分析
          if (!process.env.LLM_API_KEY) {
            await progressManager.update(repositoryUrl, {
              status: 'failed',
              details: 'LLM API密钥未配置，请设置 LLM_API_KEY',
            });
            return;
          }

          const llmConfig = {
            provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'custom',
            apiKey: process.env.LLM_API_KEY.split(',').map((k) => k.trim()),
            model: process.env.LLM_MODEL || 'deepseek-reasoner',
            baseURL: process.env.LLM_BASE_URL || undefined,
          };

          const orchestrator = new AnalysisOrchestrator(
            {
              llmConfig,
              analysisType: analysisType as any,
              maxFilesToAnalyze: 15,
              includePatterns: ['**/*.{js,ts,py,java,go,rs,php,rb}'],
              excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.min.*'],
            },
            tempDir,
          );

          // 执行深度分析
          const result: AnalysisResult = await orchestrator.analyzeRepository(
            repositoryUrl,
            tempDir,
            metadata,
            async (progress) => {
              try {
                // 更新进度
                await updateProgress(
                  30 + Math.round(progress.progress * 0.7), // 调整进度计算，确保最终能到100%
                  progress.stage,
                  progress.details,
                );
              } catch (error) {
                console.error('更新进度失败:', error);
              }
            },
          );

          await updateProgress(95, '保存结果', '正在保存分析结果...');

          // 缓存结果
          await cacheManager.set(cacheKey, result, 3600); // 1小时缓存

          // 保存到数据库
          const dbResult = {
            repositoryUrl,
            owner: metadata.owner,
            repo: metadata.name,
            metadata,
            structure: result.structure,
            dependencies: result.dependencies,
            codeQuality: result.codeQuality,
            llmInsights: result.llmInsights,
            status: 'completed' as const,
          };
          await DatabaseAccess.saveAnalysisResult(dbResult);

          await updateProgress(100, '完成', '分析完成');
          await progressManager.update(repositoryUrl, {
            status: 'completed',
            progress: 100,
            stage: '完成',
            details: '分析完成',
          });
        } catch (error) {
          console.error('LLM分析错误:', error);
          await progressManager.update(repositoryUrl, {
            status: 'failed',
            details: error instanceof Error ? error.message : '分析失败',
          });

          // 如果LLM失败，返回基础分析
          const basicResult: AnalysisResult = {
            metadata,
            structure: {
              root: {
                name: repo || metadata.name,
                type: 'directory',
                path: '.',
                size: metadata.size,
              },
              totalFiles: 0,
              totalDirectories: 0,
              languages: { [metadata.language]: metadata.size },
              keyFiles: [],
            },
            dependencies: Object.entries(metadata.topics || {}).map(([name, version]) => ({
              name,
              version: version as string,
              type: 'production',
            })),
            codeQuality: {
              complexity: { average: 0, max: 0, files: [] },
              duplication: 0,
              maintainability: 0,
              securityIssues: [],
            },
            llmInsights: 'LLM分析暂时不可用',
          };

          await cacheManager.set(cacheKey, basicResult, 1800); // 30分钟缓存

          // 保存基础结果到数据库
          const dbResult = {
            repositoryUrl,
            owner: metadata.owner,
            repo: metadata.name,
            lastCommitHash: metadata.lastCommit.sha,
            metadata,
            structure: basicResult.structure,
            dependencies: basicResult.dependencies,
            codeQuality: basicResult.codeQuality,
            llmInsights: basicResult.llmInsights,
            status: 'completed' as const,
          };
          await DatabaseAccess.saveAnalysisResult(dbResult);
        } finally {
          // 清理临时目录
          await tempManager.cleanupTempDirectory(tempDir);
        }
      } catch (error) {
        console.error('分析错误:', error);
        await progressManager.update(repositoryUrl, {
          status: 'failed',
          details: error instanceof Error ? error.message : '分析失败',
        });
      }
    }, 0);

    // 立即返回进度ID
    return NextResponse.json({
      success: true,
      analysisId: analysisId,
      message: '分析已启动',
    });
  } catch (error) {
    console.error('分析错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '分析失败',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '代码仓库分析API已就绪',
    endpoints: {
      POST: '/api/analyze',
    },
    example: {
      repositoryUrl: 'https://github.com/owner/repository 或 https://gitlab.com/group/project',
      analysisType: 'full',
    },
  });
}