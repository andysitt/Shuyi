'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Package,
  Shield,
  FileText,
  Clock,
  Activity,
  GitBranch,
  AlertCircle,
  Zap,
  TrendingUp,
  Users,
  Calendar,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/lib/utils';

import { RepositoryMetadata, RepositoryStructure, DependencyInfo, CodeQualityMetrics } from '@/app/types';

interface AnalysisResultsProps {
  data: {
    metadata: RepositoryMetadata;
    structure: RepositoryStructure;
    dependencies: DependencyInfo[];
    codeQuality: CodeQualityMetrics;
    llmInsights: any;
    repositoryUrl: string;
  };
  repoPath: string;
}

export function AnalysisResults({ data, repoPath }: AnalysisResultsProps) {
  const t = useTranslations('AnalysisResults');
  const [activeTab, setActiveTab] = useState('insights');
  const { metadata, structure, dependencies, codeQuality } = data;

  const LanguageBar = ({ languages }: { languages: Record<string, number> }) => {
    const total = Object.values(languages).reduce((sum, count) => sum + count, 0);
    const colors = [
      '#3178c6',
      '#f7df1e',
      '#4f46e5',
      '#dc2626',
      '#16a34a',
      '#9333ea',
      '#ea580c',
      '#0891b2',
      '#be185d',
      '#7c3aed',
    ];

    return (
      <div className="space-y-2">
        <div className="flex h-2 w-full rounded-full overflow-hidden">
          {Object.entries(languages).map(([lang, count], index) => (
            <div
              key={lang}
              className="h-full transition-all duration-300"
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: colors[index % colors.length],
              }}
              title={`${lang}: ${count} files`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(languages).map(([lang, count]) => (
            <div key={lang} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: colors[Object.keys(languages).indexOf(lang) % colors.length],
                }}
              />
              <span className="text-sm text-muted-foreground">
                {lang} ({count})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full">
      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" style={{ height: 'calc(100% - 4rem)' }}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> {t('aiInsights')}
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> {t('overview')}
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> {t('structure')}
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> {t('dependencies')}
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> {t('quality')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('projectOverview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('languageDistribution')}</h3>
                {structure?.languages && <LanguageBar languages={structure.languages} />}
              </div>

              {/* Topics */}
              {metadata.topics.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">主题标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.topics.map((topic: string) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      创建于: {new Date(metadata.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t('updatedAt')}: {new Date(metadata.updatedAt).toLocaleDateString('en-US')}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {metadata.license && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">许可证: {metadata.license}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">作者: {metadata.owner}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('projectStructureAnalysis')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('fileStatistics')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('totalFiles')}:</span>
                        <span className="font-semibold">{structure?.totalFiles || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('totalDirectories')}:</span>
                        <span className="font-semibold">{structure?.totalDirectories || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('languageCount')}:</span>
                        <span className="font-semibold">{Object.keys(structure?.languages || {}).length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold mb-4">{t('detailedLanguageStats')}</h3>
                  <div className="space-y-3">
                    {Object.entries(structure?.languages || {}).map(([lang, count]) => (
                      <div key={lang} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                          <span className="font-medium">{lang}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {String(count)} {t('files')}
                          </span>
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{
                                width: `${
                                  (Number(count) / Math.max(...Object.values(structure?.languages || {}).map(Number))) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('dependencyAnalysis')}</CardTitle>
            </CardHeader>
            <CardContent>
              {dependencies.length === 0 ? (
                <p className="text-muted-foreground">{t('noDependenciesFound')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dependencies.map((dep) => (
                    <Card key={dep.name} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{dep.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {t('version')}: {dep.version}
                          </p>
                          <Badge variant={dep.type === 'production' ? 'default' : 'secondary'} className="text-xs">
                            {dep.type === 'production' ? t('production') : t('development')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('codeQualityAnalysis')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quality Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      {t('maintainability')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-500">{codeQuality?.maintainability || 0}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      {t('avgComplexity')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-500">{codeQuality?.complexity?.average || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      {t('maxComplexity')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-500">{codeQuality?.complexity?.max || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Complexity Details */}
              {codeQuality?.complexity?.files && codeQuality.complexity.files.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t('fileComplexityDetails')}</h3>
                  <div className="space-y-2">
                    {codeQuality.complexity.files
                      .sort((a, b) => b.complexity - a.complexity)
                      .slice(0, 150)
                      .map((file: any) => (
                        <div key={file.path} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{file.path}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {file.lines} {t('lines')}
                            </span>
                            <span
                              className={cn(
                                'text-xs px-2 py-1 rounded-full',
                                file.complexity > 10
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : file.complexity > 5
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                              )}
                            >
                              {`${t('complexity')}:${file.complexity}`}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6 h-full">
          <Card className="h-[100%]">
            <iframe src={`/project/${repoPath}`} className="w-full h-full rounded-lg"></iframe>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
