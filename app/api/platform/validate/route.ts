// app/api/platform/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PlatformFactory, detectPlatform, parseRepositoryIdentifier } from '@/app/lib/platform-client';

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const platform = await detectPlatform(url);
    
    if (platform === 'unknown') {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    const client = PlatformFactory.createClient(platform);
    const validationResult = await client.validateRepository(url);
    
    return NextResponse.json({
      ...validationResult,
      platform // 在响应中包含平台信息
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}