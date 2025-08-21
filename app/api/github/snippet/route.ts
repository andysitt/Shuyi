import {
  NextResponse
} from 'next/server';

// Helper to parse line numbers from hash, e.g., #L10-L25
const parseLineRange = (hash: string): {
  startLine: number;
  endLine: number;
} | null => {
  const match = hash.match(/^#L(\d+)(?:-L(\d+))?$/);
  if (!match) return null;
  const startLine = parseInt(match[1], 10);
  const endLine = match[2] ? parseInt(match[2], 10) : startLine;
  return {
    startLine,
    endLine
  };
};

export async function GET(request: Request) {
  const {
    searchParams
  } = new URL(request.url);
  const fileUrl = searchParams.get('fileUrl'); // e.g., /owner/repo/blob/branch/path/to/file.md
  const hash = searchParams.get('hash'); // e.g., #L10-L25

  if (!fileUrl) {
    return NextResponse.json({
      error: 'Missing fileUrl parameter'
    }, {
      status: 400
    });
  }

  // Construct the raw content URL
  const rawUrl = `https://raw.githubusercontent.com${fileUrl.replace('/blob/', '/')}`;

  try {
    const response = await fetch(rawUrl);
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch from GitHub: ${response.statusText}`,
          details: errorText
        },
        {
          status: response.status
        }
      );
    }

    const textContent = await response.text();
    let finalContent = textContent;

    if (hash) {
      const range = parseLineRange(hash);
      if (range) {
        const lines = textContent.split('\n');
        // Line numbers are 1-based, array indices are 0-based
        const slicedLines = lines.slice(range.startLine - 1, range.endLine);
        finalContent = slicedLines.join('\n');
      }
    }
    
    const fileExtension = fileUrl.split('.').pop() || '';

    return NextResponse.json({
      snippet: finalContent,
      lang: fileExtension
    });

  } catch (error) {
    console.error('Error fetching GitHub content:', error);
    return NextResponse.json({
      error: 'Internal Server Error'
    }, {
      status: 500
    });
  }
}
