'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { RepositoryInput } from '@/app/components/RepositoryInput';
import { Play, Square, CheckCircle, AlertCircle, Github, Clock, Activity } from 'lucide-react';
import { useTranslations } from 'next-intl';
// 优化状态指示器组件
const StatusIndicator = memo(({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
  <div className="text-center">
    <div
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
        color === 'blue'
          ? 'bg-blue-100 dark:bg-blue-900'
          : color === 'yellow'
            ? 'bg-yellow-100 dark:bg-yellow-900'
            : 'bg-green-100 dark:bg-green-900'
      }`}
    >
      <Icon
        className={`w-5 h-5 ${
          color === 'blue' ? 'text-blue-500' : color === 'yellow' ? 'text-yellow-500' : 'text-green-500'
        }`}
      />
    </div>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
));
StatusIndicator.displayName = 'StatusIndicator';

// 优化进度显示组件
const ProgressDisplay = memo(({ currentStage, progress, tProgress }: { currentStage: string; progress: number; tProgress: (key: string) => string }) => {
  // 如果 currentStage 是一个国际化键值，则使用翻译函数，否则直接显示
  const displayStage = tProgress(currentStage) || currentStage;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground">{displayStage}</span>
        <span className="text-sm font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-3" />
    </div>
  );
});
ProgressDisplay.displayName = 'ProgressDisplay';

// 优化仓库信息显示组件
const RepositoryInfo = memo(({ repositoryUrl }: { repositoryUrl: string }) => (
  <div className="bg-muted/50 rounded-lg p-4">
    <div className="flex items-center gap-2 text-sm">
      <Github className="w-4 h-4" />
      <span className="font-mono truncate">{repositoryUrl}</span>
    </div>
  </div>
));
RepositoryInfo.displayName = 'RepositoryInfo';

// 优化错误显示组件
const ErrorDisplay = memo(({ error }: { error: string }) => (
  <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
    <span className="text-sm text-red-500">{error}</span>
  </div>
));
ErrorDisplay.displayName = 'ErrorDisplay';

export default function AnalyzePageClient() {
  const t = useTranslations('AnalyzePage');
  const tProgress = useTranslations('analysisProgress');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('initializingAnalysis');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventSourceRef = useRef<(() => void) | null>(null);

  // 使用 useMemo 优化计算值
  const isCompleted = useMemo(() => progress === 100, [progress]);
  const progressPercentage = useMemo(() => Math.round(progress), [progress]);

  // 使用 useCallback 优化回调函数
  const updateUrl = useCallback((url: string) => {
    setRepositoryUrl(decodeURIComponent(url));
  }, []);

  const startProgressPolling = useCallback(
    (id: string) => {
      if (!repositoryUrl) return () => {};

      const repoUrl = new URL(repositoryUrl);
      const eventSource = new EventSource(`/api/analysis/progress${repoUrl.pathname}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.success) {
          setProgress(data.progress.progress);
          setCurrentStage(data.progress.stage);

          if (data.progress.status === 'completed') {
            eventSource.close();
            // Analysis completed, fetch final result
            fetch(`/api/projects?repositoryUrl=${encodeURIComponent(repositoryUrl)}`)
              .then((res) => res.json())
              .then((result) => {
                if (result.success && result.project) {
                  const repoPath = new URL(result.project.repositoryUrl).pathname.substring(1);
                  router.push(`/analysis/${repoPath}`);
                } else {
                  throw new Error(result.error || 'Could not find analysis results');
                }
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to get analysis results');
                setIsAnalyzing(false);
              });
          } else if (data.progress.status === 'failed') {
            eventSource.close();
            setError(data.progress.details || 'Analysis failed');
            setIsAnalyzing(false);
          }
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
      };

      // Clean up the event source on component unmount
      return () => {
        eventSource.close();
      };
    },
    [router, repositoryUrl],
  );

  const checkAnalysisStatus = useCallback(
    async (url: string) => {
      try {
        const repoPath = new URL(url).pathname.substring(1);
        const response = await fetch(`/api/analysis/status/${repoPath}`);
        const data = await response.json();

        if (data.success && data.analysis) {
          const { id, status, progress, stage } = data.analysis;
          if (status === 'pending' || status === 'analyzing') {
            setAnalysisId(id);
            setIsAnalyzing(true);
            setProgress(progress);
            setCurrentStage(stage);
            eventSourceRef.current = startProgressPolling(id);
          }
        }
      } catch (err) {
        console.error('Failed to check analysis status:', err);
      }
    },
    [startProgressPolling, setAnalysisId, setIsAnalyzing, setProgress, setCurrentStage],
  );

  // 检查是否有预填充的URL, 并检查其状态
  useEffect(() => {
    const url = searchParams.get('url');
    if (url) {
      const decodedUrl = decodeURIComponent(url);
      updateUrl(decodedUrl);
      checkAnalysisStatus(decodedUrl);
    }
  }, [searchParams, updateUrl, checkAnalysisStatus]);

  const startAnalysis = useCallback(
    async (url?: string) => {
      const analysisUrl = url || repositoryUrl;
      if (!analysisUrl) {
        setError(t('enterRepositoryUrl'));
        return;
      }

      try {
        setIsAnalyzing(true);
        setError(null);
        setProgress(0);
        setCurrentStage(t('initializingAnalysis'));

        // 启动分析
        // app/api/doc-generation
        const response = await fetch('/api/analyze', {
          // const response = await fetch('/api/doc-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ repositoryUrl: analysisUrl }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || t('analysisStartFailed'));
        }

        // 保存分析ID用于轮询进度
        setAnalysisId(data.analysisId);

        // 开始轮询进度
        eventSourceRef.current = startProgressPolling(data.analysisId);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('analysisStartFailed'));
        setIsAnalyzing(false);
      }
    },
    [repositoryUrl, startProgressPolling, t, setAnalysisId, setError, setIsAnalyzing, setProgress, setCurrentStage],
  );

  const cancelAnalysis = useCallback(async () => {
    if (!repositoryUrl) return;

    try {
      const repoPath = new URL(repositoryUrl).pathname.substring(1);
      // 取消分析
      await fetch(`/api/analysis/cancel/${repoPath}`, {
        method: 'POST',
      });

      // 停止轮询
      if (eventSourceRef.current) {
        eventSourceRef.current();
        eventSourceRef.current = null;
      }

      setIsAnalyzing(false);
      setProgress(0);
      setCurrentStage(t('cancelled'));
    } catch (err) {
      console.error('取消分析失败:', err);
    }
  }, [repositoryUrl, t, setIsAnalyzing, setProgress, setCurrentStage]);

  const handleRepositorySubmit = useCallback(
    async (url: string) => {
      setRepositoryUrl(url);
      // 如果已经输入了URL，直接开始分析
      if (url) {
        await startAnalysis(url);
      }
    },
    [startAnalysis, setRepositoryUrl],
  );

  // 使用 useMemo 优化条件渲染的值
  const cardTitleContent = useMemo(
    () =>
      isAnalyzing ? (
        <>
          <Activity className="w-5 h-5 text-primary animate-pulse" />
          {t('analyzing')}
        </>
      ) : (
        <>
          <Play className="w-5 h-5 text-primary" />
          {t('startNewAnalysis')}
        </>
      ),
    [isAnalyzing, t],
  );

  const cardDescriptionContent = useMemo(
    () => (isAnalyzing ? t('analyzingDescription') : t('startDescription')),
    [isAnalyzing, t],
  );

  const RInput = memo(({ url }: { url: string }) => (
    <RepositoryInput
      onRepositorySubmit={handleRepositorySubmit}
      loading={false}
      error={error || ''}
      defaultUrl={url || ''}
    />
  ));
  RInput.displayName = 'RInput';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Github className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('title')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('description')}</p>
        </div>

        {/* Analysis Card */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{cardTitleContent}</CardTitle>
            <CardDescription>{cardDescriptionContent}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isAnalyzing ? (
              <RInput url={repositoryUrl} />
            ) : (
              <>
                {/* Progress Display */}
                <ProgressDisplay currentStage={currentStage} progress={progressPercentage} tProgress={tProgress} />

                {/* Repository Info */}
                <RepositoryInfo repositoryUrl={repositoryUrl} />

                {/* Cancel Button */}
                <div className="flex justify-center">
                  <Button onClick={cancelAnalysis} variant="destructive" className="flex items-center gap-2">
                    <Square className="w-4 h-4" />
                    {t('cancelAnalysis')}
                  </Button>
                </div>
              </>
            )}

            {/* Status Indicators */}
            {isAnalyzing && (
              <div className="grid grid-cols-3 gap-4 pt-4">
                <StatusIndicator icon={Clock} label={t('status.preparing')} color="blue" />
                <StatusIndicator icon={Activity} label={t('status.analyzing')} color="yellow" />
                <StatusIndicator icon={CheckCircle} label={t('status.completed')} color="green" />
              </div>
            )}

            {error && <ErrorDisplay error={error} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
