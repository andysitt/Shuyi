import { NextRequest } from 'next/server';
import { DocsManager } from '../../lib/docs-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  try {
    console.log('------', params);
    // 解析路径参数
    if (!params.path || params.path.length < 2) {
      return new Response('文档未找到', { status: 404 });
    }

    // 获取文档名称（最后一个元素）并移除 .md 扩展名
    const docNameWithExt = params.path[params.path.length - 1];
    if (!docNameWithExt.endsWith('.md')) {
      return new Response('文档未找到', { status: 404 });
    }
    const docName = docNameWithExt.slice(0, -3);

    // 获取项目路径（除最后一个元素外的所有元素）
    const projectPath = params.path.slice(0, -1).join('/');

    // 获取文档内容
    const content = await DocsManager.getDoc(projectPath, docName);

    if (content === null) {
      return new Response('文档未找到', { status: 404 });
    }

    // 返回 Markdown 内容
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('获取文档时出错:', error);
    return new Response('服务器内部错误', { status: 500 });
  }
}
