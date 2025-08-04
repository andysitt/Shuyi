'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { RepositoryInput } from '@/app/components/RepositoryInput';
import {
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Github,
  Clock,
  Activity,
} from 'lucide-react';

export default function AnalysisProgressPage() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('准备开始');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // 检查是否有预填充的URL
  useEffect(() => {
    const url = searchParams.get('url');
    if (url) {
      setRepositoryUrl(decodeURIComponent(url));
    }
  }, [searchParams]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const startAnalysis = async (url?: string) => {
    const analysisUrl = url || repositoryUrl;
    if (!analysisUrl) {
      setError('请输入GitHub仓库URL');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setProgress(0);
      setCurrentStage('初始化分析...');

      // 启动分析
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryUrl: analysisUrl }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '分析启动失败');
      }

      // 保存分析ID用于轮询进度
      setAnalysisId(data.analysisId);

      // 开始轮询进度
      startProgressPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析启动失败');
      setIsAnalyzing(false);
    }
  };

  const startProgressPolling = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(async () => {
      if (!analysisId) return;

      try {
        const response = await fetch(`/api/analysis/progress/${analysisId}`);
        const data = await response.json();

        if (data.success) {
          setProgress(data.progress.progress);
          setCurrentStage(data.progress.stage);

          // 检查是否完成
          if (data.progress.status === 'completed') {
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
            }
            // 导航到结果页面
            router.push(`/analysis/${data.progress.id}`);
          } else if (data.progress.status === 'failed') {
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
            }
            setError(data.progress.details || '分析失败');
            setIsAnalyzing(false);
          }
        }
      } catch (err) {
        console.error('获取进度失败:', err);
      }
    }, 1000); // 每秒轮询一次
  };

  const cancelAnalysis = async () => {
    if (!analysisId) return;

    try {
      // 取消分析
      await fetch(`/api/analysis/cancel/${analysisId}`, {
        method: 'POST',
      });

      // 停止轮询
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }

      setIsAnalyzing(false);
      setProgress(0);
      setCurrentStage('已取消');
    } catch (err) {
      console.error('取消分析失败:', err);
    }
  };

  const handleRepositorySubmit = async (url: string) => {
    setRepositoryUrl(url);
    // 如果已经输入了URL，直接开始分析
    if (url) {
      await startAnalysis(url);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Github className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            GitHub仓库分析器
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            输入GitHub仓库URL，我们将为您提供全面的代码分析报告
          </p>
        </div>

        {/* Analysis Card */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isAnalyzing ? (
                <>
                  <Activity className="w-5 h-5 text-primary animate-pulse" />
                  分析进行中
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 text-primary" />
                  开始新分析
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isAnalyzing
                ? '正在分析仓库，请耐心等待...'
                : '输入GitHub仓库URL开始分析'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isAnalyzing ? (
              <>
                <RepositoryInput
                  onRepositorySubmit={handleRepositorySubmit}
                  loading={false}
                  error={error || ''}
                />
              </>
            ) : (
              <>
                {/* Progress Display */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {currentStage}
                    </span>
                    <span className="text-sm font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                {/* Repository Info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Github className="w-4 h-4" />
                    <span className="font-mono truncate">{repositoryUrl}</span>
                  </div>
                </div>

                {/* Cancel Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={cancelAnalysis}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    取消分析
                  </Button>
                </div>
              </>
            )}

            {/* Status Indicators */}
            {isAnalyzing && (
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full mb-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">准备阶段</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-2">
                    <Activity className="w-5 h-5 text-yellow-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">分析中</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">完成</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-500">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
