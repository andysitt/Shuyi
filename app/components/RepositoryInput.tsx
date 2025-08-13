'use client';

import { useState } from 'react';
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

export function RepositoryInput({
  onRepositorySubmit,
  loading,
  error,
  defaultUrl,
}: RepositoryInputProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!(url || '').trim()) {
      setValidationError('请输入GitHub仓库URL');
      return;
    }

    if (!isValidGitHubUrl(url || '')) {
      setValidationError('请输入有效的GitHub仓库URL');
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
              GitHub仓库URL
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
                placeholder="https://github.com/owner/repository"
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

          <Button
            type="submit"
            disabled={loading || !(url || '').trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                开始分析
              </>
            )}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            支持公共GitHub仓库，例如：
          </p>
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
