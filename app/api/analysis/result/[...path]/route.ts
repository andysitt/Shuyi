import { NextResponse } from 'next/server';
import { DatabaseAccess } from '@/app/lib/db-access';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;
    if (!path || path.length === 0) {
      return NextResponse.json({ success: false, error: 'Repository path is required' }, { status: 400 });
    }
    const repoPath = path.join('/');
    const repositoryUrl = `https://github.com/${repoPath}`;

    // Get analysis result by repository URL
    const result = await DatabaseAccess.getAnalysisResult(repositoryUrl);

    if (!result) {
      return NextResponse.json({ success: false, error: '未找到分析结果' }, { status: 404 });
    }

    // 转换数据格式
    const analysisData = {
      id: result.id,
      updatedAt: result.updatedAt,
      metadata: result.metadata,
      structure: result.structure,
      dependencies: result.dependencies,
      codeQuality: result.codeQuality,
      llmInsights: result.llmInsights,
      repositoryUrl: result.repositoryUrl,
    };

    return NextResponse.json({
      success: true,
      data: analysisData,
    });
  } catch (error) {
    console.error('获取分析结果失败:', error);
    return NextResponse.json({ success: false, error: '获取分析结果失败' }, { status: 500 });
  }
}
