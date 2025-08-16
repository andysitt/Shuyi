'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Star, Code, Calendar } from 'lucide-react';

interface ProjectCardProps {
  githubUrl: string;
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
          const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (match) {
            const [, owner, repo] = match;
            const metadataResponse = await fetch(`/api/github/metadata?owner=${owner}&repo=${repo.replace('.git', '')}`);
            if (!metadataResponse.ok) {
              throw new Error('Failed to fetch repository metadata');
            }
            const metadataData = await metadataResponse.json();
            setMetadata(metadataData);
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
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl: githubUrl }),
      });
      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }
      const data = await response.json();
      // Re-fetch status to show the analysis has started
      const repoPath = new URL(githubUrl).pathname.substring(1);
      const statusResponse = await fetch(`/api/analysis/status/${repoPath}`);
      const statusData = await statusResponse.json();
      setAnalysis(statusData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (analysis && analysis.id) {
    // Analyzed
    const repoPath = new URL(analysis.repository_url).pathname.substring(1);
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
          <CardDescription className="line-clamp-2">
            {metadata.description || 'No description'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {metadata.language}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {metadata.stars} stars
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {new Date(metadata.createdAt).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>
          <Button onClick={startAnalysis} className="mt-4">Start Analysis</Button>
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