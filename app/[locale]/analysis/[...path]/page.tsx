'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnalysisResults } from '@/app/components/AnalysisResults';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Github, Star, Code, ArrowLeft, RefreshCw, Share2, Clock, Download } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { IAnalysisResult } from '@/app/lib/db-access';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';

export default function AnalysisDetailPage() {
  const t = useTranslations('AnalysisPage');
  const [analysisData, setAnalysisData] = useState<IAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { path } = params as { path: string[] };

  const fetchAnalysisData = useCallback(async () => {
    if (!path || path.length === 0) return;
    const repoPath = path.join('/');
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/analysis/result/${repoPath}`);
      const data = await response.json();

      if (data.success) {
        setAnalysisData(data.data);
      } else {
        throw new Error(data.error || '获取分析结果失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [path, t]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  const handleBack = () => {
    // 获取当前语言环境
    const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'zh-CN';
    const isLocaleSupported = ['zh-CN', 'en'].includes(locale);
    const prefix = isLocaleSupported ? `/${locale}` : '';
    router.push(prefix || '/');
  };

  const handleReanalyze = async () => {
    if (!analysisData?.repositoryUrl) return;
    try {
      // 获取当前语言环境
      const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'zh-CN';
      const isLocaleSupported = ['zh-CN', 'en'].includes(locale);
      const prefix = isLocaleSupported ? `/${locale}` : '';
      router.push(`${prefix}/analyze?url=${encodeURIComponent(analysisData.repositoryUrl)}`);
    } catch (err) {
      console.error('重新分析失败:', err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (err) {
      console.error('复制链接失败:', err);
    }
  };

  const handleExportDocs = async () => {
    if (!analysisData) return;
    
    try {
      const repoPath = path.join('/');
      // Get current locale
      const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'zh-CN';
      const response = await fetch(`/api/analysis/export/${repoPath}?lang=${locale}`);
      
      if (!response.ok) {
        throw new Error('导出失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysisData.metadata.name}-docs.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('导出文档失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center text-red-500">{t('loadFailed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground mb-4">{error}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={fetchAnalysisData} variant="outline">
                {t('retry')}
              </Button>
              <Button onClick={handleBack}>{t('backToHome')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">{t('notFound')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{t('notFoundDesc')}</p>
            <Button onClick={handleBack}>{t('backToHome')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background">
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-muted border-solid border-b-[1px]"
        onMouseEnter={() => setIsHeaderExpanded(true)}
        onMouseLeave={() => setIsHeaderExpanded(false)}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex-grow flex items-center gap-4 overflow-hidden">
            <h1 className="text-xl font-bold flex items-center gap-2 truncate">
              <Github className="w-5 h-5 flex-shrink-0" />
              <a href={analysisData.repositoryUrl} target="_blank" rel="noopener noreferrer" className="truncate">
                {analysisData.metadata.name}
              </a>
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="w-3 h-3" /> {analysisData.metadata.stars.toLocaleString()}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Code className="w-3 h-3" /> {analysisData.metadata.language}
              </Badge>
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-2 justify-center items-center">
            <LanguageSwitcher />
            {/* <Button onClick={handleShare} variant="outline" size="sm" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              {t('share')}
            </Button> */}
            <Button onClick={handleExportDocs} size="sm" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t('export')}
            </Button>
            <Button onClick={handleReanalyze} size="sm" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {t('reanalyze')}
            </Button>
            <Button onClick={handleBack} variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'container mx-auto px-4 transition-all duration-300 ease-in-out overflow-hidden bg-background/95 backdrop-blur-sm ',
            isHeaderExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="pb-3">
            <p className="text-muted-foreground text-sm">{analysisData.metadata.description}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Clock className="w-4 h-4" />
              <span>
                {t('lastAnalyzed')}: {new Date(analysisData.updatedAt).toLocaleString('zh-CN')}
              </span>
              <a href={`https://github.com/${path.join('/')}/tree/${analysisData.metadata.lastCommit?.sha || 'main'}`}>
                {`(${(analysisData.metadata.lastCommit?.sha || 'main').slice(0, 6)})`}
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 h-full">
        <div className="container mx-auto px-4 py-4 h-full">
          <AnalysisResults data={analysisData} repoPath={path.join('/')} />
        </div>
      </main>
    </div>
  );
}
