'use client'

import { useState } from 'react'
import { RepositoryInput } from '@/app/components/RepositoryInput'
import { AnalysisResults } from '@/app/components/AnalysisResults'
import { AnalysisRequest, AnalysisResult } from '@/app/types'
import { Github, Sparkles, BarChart3, FileCode } from 'lucide-react'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleRepositorySubmit = async (url: string) => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const request: AnalysisRequest = {
        repositoryUrl: url,
        analysisType: 'full'
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '分析失败')
      }

      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析过程出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Github className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            GitHub仓库智能分析器
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            使用AI驱动的工具深度分析GitHub仓库，获取结构洞察、代码质量评估和架构建议
          </p>
        </div>

        {/* Features */}
        {!result && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
              <BarChart3 className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">深度结构分析</h3>
              <p className="text-sm text-muted-foreground">全面解析项目结构，识别关键文件和目录组织</p>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
              <FileCode className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">代码质量评估</h3>
              <p className="text-sm text-muted-foreground">分析代码复杂度、依赖关系和潜在问题</p>
            </div>
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">AI智能洞察</h3>
              <p className="text-sm text-muted-foreground">基于大模型提供架构建议和优化方案</p>
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <RepositoryInput
            onRepositorySubmit={handleRepositorySubmit}
            loading={loading}
            error={error}
          />
        </div>

        {/* Results */}
        {result && (
          <div className="animate-fadeIn">
            <AnalysisResults data={result} />
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-muted/30 rounded-full mb-4">
              <Github className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">开始分析您的仓库</h3>
            <p className="text-muted-foreground">输入GitHub仓库URL，我们将为您提供全面的分析报告</p>
          </div>
        )}
      </div>
    </main>
  )
}