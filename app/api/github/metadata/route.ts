import { NextRequest, NextResponse } from 'next/server';
import { GitHubClient } from '@/app/lib/github-client';
import { cacheManager } from '@/app/lib/cache-manager';
import { RepositoryMetadata } from '@/app/types';

const CACHE_DURATION_SECONDS = 24 * 60 * 60; // 24 hours

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 });
  }

  const cacheKey = `github:metadata:${owner}/${repo}`;
  const cachedData = await cacheManager.get<RepositoryMetadata>(cacheKey);

  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  try {
    const client = new GitHubClient();
    const metadata = await client.getRepositoryMetadata(owner, repo);

    await cacheManager.set(cacheKey, metadata, CACHE_DURATION_SECONDS);

    return NextResponse.json(metadata);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
