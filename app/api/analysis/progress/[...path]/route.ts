import { NextResponse } from 'next/server';
import { progressManager } from '@/app/service/progress-manager';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const { path } = params;
  if (!path || path.length === 0) {
    return NextResponse.json({ success: false, error: 'Repository path is required' }, { status: 400 });
  }

  const repoPath = path.join('/');
  const fullUrl = `https://github.com/${repoPath}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const sendProgress = async () => {
        try {
          const progress = await progressManager.get(fullUrl);
          if (progress) {
            const data = `data: ${JSON.stringify({ success: true, progress })}\n\n`;
            if (!closed) {
              controller.enqueue(encoder.encode(data));
            } else {
              return true;
            }

            if (progress.status === 'completed' || progress.status === 'failed') {
              controller.close();
              closed = true;
              return true; // Stop polling
            }
          }
        } catch (error) {
          console.error('Failed to get analysis progress:', error);
          const data = `data: ${JSON.stringify({ success: false, error: 'Failed to get analysis progress' })}\n\n`;
          controller.enqueue(encoder.encode(data));
          controller.close();
          closed = true;
          return true; // Stop polling
        }
        return false; // Continue polling
      };

      // Send initial progress immediately
      await sendProgress();

      const intervalId = setInterval(async () => {
        const shouldStop = await sendProgress();
        if (shouldStop) {
          clearInterval(intervalId);
        }
      }, 1000); // Poll every second

      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    },
  });
}
