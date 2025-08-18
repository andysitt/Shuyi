'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Code, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { RepoSearcher } from '@/app/components/RepoSearcher';
import { AnalysisProjectCard } from '@/app/components/AnalysisProjectCard';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';

interface Project {
  id: string;
  repositoryUrl: string;
  name: string;
  description: string;
  stars: number;
  language: string;
  createdAt: Date;
  isTemporary?: boolean;
}

export default function Home() {
  const t = useTranslations('HomePage');
  const tProjectCard = useTranslations('ProjectCard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  const filterProjects = useCallback(() => {
    if (!searchTerm) {
      setFilteredProjects(projects);
      return;
    }

    const filtered = projects.filter(
      (project) =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  useEffect(() => {
    filterProjects();
  }, [filterProjects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (repositoryUrl: string) => {
    const repoUrl = new URL(repositoryUrl);
    // 获取当前语言环境
    const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'zh-CN';
    const isLocaleSupported = ['zh-CN', 'en'].includes(locale);
    const prefix = isLocaleSupported ? `/${locale}` : '';
    router.push(`${prefix}/analysis/${repoUrl.pathname.substring(1)}`);
  };

  const handleAnalysisSubmit = async (url: string) => {
    setLoading(true);
    setError(null);
    setSearchTerm(url); // show the url in search input

    try {
      // 1. Validate URL
      const validationResponse = await fetch('/api/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const validationResult = await validationResponse.json();

      if (!validationResult.isValid) {
        setError(validationResult.error);
        setFilteredProjects(projects); // Show all projects
        return;
      }

      // 2. Check if project is already analyzed
      const existingProject = projects.find((p) => p.repositoryUrl === url);
      if (existingProject) {
        setFilteredProjects([existingProject]);
        return;
      }

      // 3. Fetch metadata for unanalyzed project
      const { owner, repo } = validationResult;
      const metadataResponse = await fetch(`/api/github/metadata?owner=${owner}&repo=${repo}`);
      const metadata = await metadataResponse.json();

      const repoUrl = `https://github.com/${owner}/${repo}`;
      // Create a temporary project object
      const tempProject: Project = {
        id: 'temp-' + Date.now(), // Temporary ID
        repositoryUrl: repoUrl,
        name: metadata.name,
        description: metadata.description,
        stars: metadata.stars,
        language: metadata.language,
        createdAt: new Date(metadata.createdAt),
        isTemporary: true, // Flag to render AnalysisProjectCard
      };

      setFilteredProjects([tempProject]);
      return repoUrl;
    } catch (error) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  let gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  if (filteredProjects.length === 2) {
    gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 w-[66%] mx-auto';
  }
  if (filteredProjects.length === 1) {
    gridClassName = 'grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6 w-[33%] mx-auto';
  }
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 ">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text ">
            {t('title')}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">{t('description')}</p>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 flex justify-center">
            <RepoSearcher onAnalysisSubmit={handleAnalysisSubmit} />
          </div>
        </div>

        {error && <div className="text-red-500 text-center mb-4">{error}</div>}

        {/* Projects List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('loading')}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-muted/30 rounded-full mb-4">
              <Code className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchTerm ? t('noMatchingProjects') : t('noProjects')}
            </h3>
            <p className="text-muted-foreground">{searchTerm ? t('tryDifferentKeywords') : t('startAnalysis')}</p>
          </div>
        ) : (
          <div className={gridClassName}>
            {filteredProjects.map((project) =>
              project.isTemporary ? (
                <AnalysisProjectCard key={project.id} githubUrl={project.repositoryUrl} />
              ) : (
                <ProjectCard key={project.id} project={project} onViewDetails={handleViewDetails} t={tProjectCard} />
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ProjectCard({
  project,
  onViewDetails,
  t,
}: {
  project: Project;
  onViewDetails: (repositoryUrl: string) => void;
  t: any;
}) {
  return (
    <Card
      className="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={() => onViewDetails(project.repositoryUrl)}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{project.name}</span>
          <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 ml-2" />
        </CardTitle>
        <CardDescription className="line-clamp-2">{project.description || t('noDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{project.language}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {project.stars} {t('stars')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {new Date(project.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
