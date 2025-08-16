'use client';

import { useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

interface RepoSearcherProps {
  onAnalysisSubmit: (url: string) => void;
}

export function RepoSearcher({ onAnalysisSubmit }: RepoSearcherProps) {
  const [githubUrl, setGithubUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (githubUrl) {
      onAnalysisSubmit(githubUrl);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl items-center space-x-2">
      <Input
        type="text"
        placeholder="Enter a GitHub repository URL"
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">Analyze</Button>
    </form>
  );
}
