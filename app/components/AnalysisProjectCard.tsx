'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Star, Code, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchRepositoryMetadata, parseRepositoryInfo } from '@/app/lib/platform-metadata';

interface ProjectCardProps {
  githubUrl: string; // 为了向后兼容，保持原名
}

interface RepositoryMetadata {
  name: string;
  description: string;
  stars: number;
  language: string;
  createdAt: Date;
}

export function AnalysisProjectCard({ githubUrl }: ProjectCardProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [metadata, setMetadata] = useState<RepositoryMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchAnalysisAndMetadata() {
      try {
        // Fetch analysis status
        const repoPath = new URL(githubUrl).pathname.substring(1);
        const analysisResponse = await fetch(`/api/analysis/status/${repoPath}`);
        if (!analysisResponse.ok) {
          throw new Error('Failed to fetch analysis status');
        }
        const analysisData = await analysisResponse.json();
        setAnalysis(analysisData);

        // If not analyzed, fetch metadata
        if (!analysisData.id) {
          const { metadata, error } = await fetchRepositoryMetadata(githubUrl);
          
          if (error) {
            setError(error);
            return;
          }
          
          if (metadata) {
            setMetadata(metadata);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    if (githubUrl) {
      fetchAnalysisAndMetadata();
    }
  }, [githubUrl]);

  const startAnalysis = async () => {
    if (!githubUrl) return;
    try {
      // 获取当前语言环境
      const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'zh-CN';
      const isLocaleSupported = ['zh-CN', 'en'].includes(locale);
      const prefix = isLocaleSupported ? `/${locale}` : '';
      router.push(`${prefix}/analyze?url=${encodeURIComponent(githubUrl)}`);
    } catch (err) {
      console.error('跳转分析失败:', err);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (analysis && analysis.id) {
    // Analyzed - 使用URL编码支持多平台路径
    const repoPath = encodeURIComponent(analysis.repository_url);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{analysis.repository_url}</CardTitle>
          <CardDescription>Project has been analyzed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/analysis/${repoPath}`}>
            <Button>View Analysis</Button>
          </Link>
        </CardContent>
      </Card>
    );
  } else if (metadata) {
    // Not analyzed, but metadata is available
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate">{metadata.name}</span>
            <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 ml-2" />
          </CardTitle>
          <CardDescription className="line-clamp-2">{metadata.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{metadata.language}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{metadata.stars} stars</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {new Date(metadata.createdAt).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>
          <Button onClick={startAnalysis} className="mt-4">
            Start Analysis
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    // Not analyzed, no metadata (e.g., invalid URL)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{githubUrl}</CardTitle>
          <CardDescription>Could not retrieve repository information.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
}
