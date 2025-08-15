import { NextRequest, NextResponse } from 'next/server';
import { DatabaseAccess } from '@/app/lib/db-access';

export async function GET(request: NextRequest) {
  const repositoryUrl = request.nextUrl.searchParams.get('repositoryUrl');

  if (!repositoryUrl) {
    return NextResponse.json(
      { success: false, error: 'repositoryUrl is required' },
      { status: 400 },
    );
  }

  try {
    const analysisId = Buffer.from(repositoryUrl).toString('base64');
    const progress = await DatabaseAccess.getAnalysisProgressById(analysisId);

    if (!progress) {
      return NextResponse.json(
        { success: true, analysis: null, message: 'No active analysis found for this URL.' },
        { status: 200 },
      );
    }

    return NextResponse.json({ success: true, analysis: progress });

  } catch (error) {
    console.error(`Failed to get analysis status for ${repositoryUrl}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
