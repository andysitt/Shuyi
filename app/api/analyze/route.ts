import { NextRequest, NextResponse } from 'next/server'
import { GitHubClient } from '@/app/lib/github-client'
import { AnalysisOrchestrator } from '@/app/lib/analysis-orchestrator'
import { cacheManager, tempManager } from '@/app/lib/cache-manager'
import { AnalysisRequest } from '@/app/types'

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json()
    const { repositoryUrl, analysisType = 'full' } = body

    if (!repositoryUrl) {
      return NextResponse.json(
        { success: false, error: '仓库URL是必需的' },
        { status: 400 }
      )
    }

    // 检查缓存
    const cacheKey = `analysis:${repositoryUrl}:${analysisType}`
    const cached = await cacheManager.get(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    // 验证仓库
    const githubClient = new GitHubClient()
    const validation = await githubClient.validateRepository(repositoryUrl)

    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.error?.includes('未找到') ? 404 : 400 }
      )
    }

    const { owner, repo } = validation

    // 获取仓库元数据
    const metadata = await githubClient.getRepositoryMetadata(owner!, repo!)

    // 创建临时目录
    const tempDir = tempManager.createTempDirectory()
    
    try {
      // 克隆仓库
      await githubClient.cloneRepository(repositoryUrl, tempDir)
      
      // 配置LLM分析
      if (!process.env.LLM_API_KEY) {
        return NextResponse.json(
          { success: false, error: 'LLM API密钥未配置，请设置 LLM_API_KEY' },
          { status: 500 }
        )
      }

      const llmConfig = {
        provider: (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'custom',
        apiKey: process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL || 'gpt-4',
        baseURL: process.env.LLM_BASE_URL || undefined
      }

      const orchestrator = new AnalysisOrchestrator({
        llmConfig,
        analysisType: analysisType as any,
        maxFilesToAnalyze: 15,
        includePatterns: ['**/*.{js,ts,py,java,go,rs,php,rb}'],
        excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.min.*']
      }, tempDir)

      // 执行深度分析
      const result = await orchestrator.analyzeRepository(
        tempDir,
        metadata,
        (progress) => {
          console.log(`分析进度: ${progress.stage} (${progress.progress}%)`)
        }
      )

      // 缓存结果
      await cacheManager.set(cacheKey, result, 3600) // 1小时缓存

      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      console.error('LLM分析错误:', error)
      
      // 如果LLM失败，返回基础分析
      const basicResult = {
        metadata,
        structure: {
          root: { name: repo, type: 'directory', path: '.', size: metadata.size },
          totalFiles: 0,
          totalDirectories: 0,
          languages: { [metadata.language]: metadata.size },
          keyFiles: []
        },
        dependencies: Object.entries(metadata.topics || {}).map(([name, version]) => ({
          name,
          version: version as string,
          type: 'production' as const
        })),
        codeQuality: {
          complexity: { average: 0, max: 0, files: [] },
          duplication: 0,
          maintainability: 0,
          securityIssues: []
        },
        llmInsights: {
          architecture: 'LLM分析暂时不可用',
          keyPatterns: [],
          potentialIssues: ['LLM服务配置问题'],
          recommendations: [
            '检查OPENAI_API_KEY或ANTHROPIC_API_KEY环境变量',
            '确保API密钥有效且有足够配额',
            '检查网络连接和API服务状态'
          ],
          technologyStack: [metadata.language],
          codeQuality: '未分析'
        }
      }
      
      await cacheManager.set(cacheKey, basicResult, 1800) // 30分钟缓存
      return NextResponse.json({ success: true, data: basicResult })
    } finally {
      // 清理临时目录
      await tempManager.cleanupTempDirectory(tempDir)
    }
  } catch (error) {
    console.error('分析错误:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'GitHub仓库分析API已就绪',
    endpoints: {
      POST: '/api/analyze',
    },
    example: {
      repositoryUrl: 'https://github.com/owner/repository',
      analysisType: 'full'
    }
  })
}