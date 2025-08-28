'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

interface RepoSearcherProps {
  onAnalysisSubmit: (url: string) => Promise<string | undefined>;
}

export function RepoSearcher({ onAnalysisSubmit }: RepoSearcherProps) {
  const t = useTranslations('HomePage');
  const [githubUrl, setGithubUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (githubUrl) {
      const newUrl = await onAnalysisSubmit(githubUrl);
      if (newUrl) {
        setGithubUrl(newUrl);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl items-center space-x-2">
      <Input
        type="text"
        placeholder={t('searchPlaceholder')}
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">{t('analyzeButton')}</Button>
    </form>
  );
}
