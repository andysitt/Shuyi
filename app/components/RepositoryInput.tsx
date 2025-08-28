'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Github, Search, AlertCircle } from 'lucide-react';
import { isValidGitHubUrl } from '@/app/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';

interface RepositoryInputProps {
  onRepositorySubmit: (url: string) => Promise<void>;
  loading: boolean;
  error?: string;
  defaultUrl?: string;
}

export function RepositoryInput({ onRepositorySubmit, loading, error, defaultUrl }: RepositoryInputProps) {
  const t = useTranslations('RepositoryInput');
  const [url, setUrl] = useState(defaultUrl);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!(url || '').trim()) {
      setValidationError(t('enterUrl'));
      return;
    }

    if (!isValidGitHubUrl(url || '')) {
      setValidationError(t('invalidUrl'));
      return;
    }

    await onRepositorySubmit(url || '');
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardContent className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repository-url" className="text-sm font-medium">
              {t('label')}
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Github className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                id="repository-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('placeholder')}
                className="pl-10"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {(validationError || error) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError || error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading || !(url || '').trim()} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('analyzing')}
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                {t('startAnalysis')}
              </>
            )}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">{t('supportedRepos')}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="outline" className="text-xs">
              https://github.com/facebook/react
            </Badge>
            <Badge variant="outline" className="text-xs">
              https://github.com/microsoft/vscode
            </Badge>
            <Badge variant="outline" className="text-xs">
              https://github.com/torvalds/linux
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
