import { NextRequest, NextResponse } from 'next/server';
import { DatabaseAccess } from '@/app/lib/db-access';
import { DocsManager } from '@/app/service/docs-manager';
import { Language } from '@/app/types';
import JSZip from 'jszip';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;
    if (!path || path.length === 0) {
      return NextResponse.json({ success: false, error: 'Repository path is required' }, { status: 400 });
    }

    const repoPath = path.join('/');
    const repositoryUrl = `github.com/${repoPath}`;

    // Get analysis result by repository URL
    const result = await DatabaseAccess.getAnalysisResult(`https://${repositoryUrl}`);

    if (!result) {
      return NextResponse.json({ success: false, error: '未找到分析结果' }, { status: 404 });
    }

    // Get current language from query params or default to Chinese
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || Language.ZH_CN;
    console.log('--------', lang, repositoryUrl);
    // Get docs for this project and language
    const docs = await DocsManager.getDocsByPathAndLang(repositoryUrl, lang);

    if (docs.length === 0) {
      return NextResponse.json({ success: false, error: '未找到文档' }, { status: 404 });
    }

    // Create a zip file containing all documents
    const zip = new JSZip();

    // Add each document to the zip file
    for (const doc of docs) {
      zip.file(`${doc.doc_name}.md`, doc.content);
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return the zip file as a downloadable file
    const fileName = `${result.metadata.name}-docs.zip`;
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('导出文档失败:', error);
    return NextResponse.json({ success: false, error: '导出文档失败' }, { status: 500 });
  }
}
