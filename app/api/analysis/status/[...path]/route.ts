import { NextResponse } from 'next/server';
import { progressManager } from '@/app/service/progress-manager';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params;

    if (!path || path.length === 0) {
      return NextResponse.json({ success: false, error: 'Repository path is required' }, { status: 400 });
    }

    const repoPath = path.join('/');
    const repositoryUrl = `https://github.com/${repoPath}`;

    const progress = await progressManager.get(repositoryUrl);

    if (!progress) {
      return NextResponse.json({ success: true, analysis: null, message: 'No active analysis found for this URL.' }, { status: 200 });
    }

    return NextResponse.json({ success: true, analysis: progress });
  } catch (error) {
    console.error('Failed to get analysis status:', error);
    return NextResponse.json({ success: false, error: 'Failed to get analysis status' }, { status: 500 });
  }
}
