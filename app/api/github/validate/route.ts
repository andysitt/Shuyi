// app/api/github/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GitHubClient } from '@/app/lib/github-client';

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const client = new GitHubClient();
    const validationResult = await client.validateRepository(url);
    return NextResponse.json(validationResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
