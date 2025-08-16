import { NextResponse } from 'next/server';
import { progressManager } from '@/app/service/progress-manager';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;

    if (!path || path.length === 0) {
      return NextResponse.json({ success: false, error: 'Repository path is required' }, { status: 400 });
    }

    const repoPath = path.join('/');
    const fullUrl = `https://github.com/${repoPath}`;

    const progress = await progressManager.get(fullUrl);

    if (!progress) {
      return NextResponse.json({ success: false, error: 'Analysis progress not found or expired' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      progress: progress,
    });
  } catch (error) {
    console.error('Failed to get analysis progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to get analysis progress' }, { status: 500 });
  }
}
