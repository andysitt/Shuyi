import { NextRequest } from 'next/server';
import { DocsManager } from '../../service/docs-manager';
import { Language } from '@/app/types';

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  try {
    const lang = request.nextUrl.searchParams.get('lang');
    // 解析路径参数
    if (!params.path || params.path.length < 2) {
      return new Response('file not found', { status: 404 });
    }

    // 获取文档名称（最后一个元素）并移除 .md 扩展名
    const docNameWithExt = params.path[params.path.length - 1];
    if (!docNameWithExt.endsWith('.md')) {
      return new Response('file not found', { status: 404 });
    }
    const docName = docNameWithExt.slice(0, -3);

    // 获取项目路径（除最后一个元素外的所有元素）
    const projectPath = params.path.slice(0, -1).join('/');

    // 获取文档内容
    const content = await DocsManager.getDoc('github.com/' + projectPath, docName, lang || Language.ZH_CN);

    if (content === null) {
      return new Response('file not found', { status: 404 });
    }

    // 返回 Markdown 内容
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('get file error:', error);
    return new Response('get file error', { status: 500 });
  }
}
