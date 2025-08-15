'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnalysisResults } from '@/app/components/AnalysisResults';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { ArrowLeft, RefreshCw, Share2 } from 'lucide-react';

export default function AnalysisDetailPage() {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const fetchAnalysisData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // 调用API获取分析结果
      const response = await fetch(`/api/analysis/${id}`);
      const data = await response.json();

      if (data.success) {
        setAnalysisData(data.data);
      } else {
        throw new Error(data.error || '获取分析结果失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取分析结果失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  const handleBack = () => {
    router.push('/');
  };

  const handleReanalyze = async () => {
    if (!analysisData?.repositoryUrl) return;

    try {
      // 重新分析
      router.push(
        `/analyze?url=${encodeURIComponent(analysisData.repositoryUrl)}`,
      );
    } catch (err) {
      console.error('重新分析失败:', err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // 这里可以添加一个提示，告诉用户链接已复制
    } catch (err) {
      console.error('复制链接失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">加载分析结果中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center text-red-500">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground mb-4">{error}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={fetchAnalysisData} variant="outline">
                重试
              </Button>
              <Button onClick={handleBack}>返回主页</Button>
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
            <CardTitle className="text-center">未找到分析结果</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">指定的分析结果不存在</p>
            <Button onClick={handleBack}>返回主页</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回主页
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={handleShare}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                分享
              </Button>
              <Button
                onClick={handleReanalyze}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新分析
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      <div className="container mx-auto px-4 py-8">
        <AnalysisResults data={analysisData} />
      </div>
    </div>
  );
}
