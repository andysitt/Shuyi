// 仓库相关类型
export interface RepositoryMetadata {
  name: string;
  description: string;
  owner: string;
  stars: number;
  language: string;
  topics: string[];
  license?: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  lastCommit: {
    sha: string;
    message: string;
    date: Date;
  };
  // GitLab特有字段
  projectId?: number;
  namespace?: string;
  visibility?: string;
}

export interface RepositoryStructure {
  root: FileNode;
  totalFiles: number;
  totalDirectories: number;
  languages: Record<string, number>;
  keyFiles: KeyFile[];
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size: number;
  language?: string;
  children?: FileNode[];
}

export interface KeyFile {
  path: string;
  type: 'package' | 'config' | 'readme' | 'main';
  description: string;
}

// 分析结果类型
export interface AnalysisResult {
  metadata: RepositoryMetadata;
  structure: RepositoryStructure;
  dependencies: DependencyInfo[];
  codeQuality: CodeQualityMetrics;
  llmInsights: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  description?: string;
}

export interface CodeQualityMetrics {
  complexity: {
    average: number;
    max: number;
    files: FileComplexity[];
  };
  duplication: number;
  testCoverage?: number;
  maintainability: number;
  securityIssues: SecurityIssue[];
}

export interface FileComplexity {
  path: string;
  complexity: number;
  lines: number;
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  file: string;
  line?: number;
  description: string;
}

export interface LLMInsights {
  architecture: string;
  keyPatterns: string[];
  potentialIssues: string[];
  recommendations: string[];
  technologyStack: string[];
  codeQuality: string;
}

// LLM工具相关类型
export interface LLMTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: any): Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface SessionContext {
  sessionId: string;
  repositoryPath: string;
  toolResults: ToolResult[];
  analysisGoal: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalysisRequest {
  repositoryUrl: string;
  analysisType?: 'full' | 'structure' | 'quality' | 'documentation';
}

// 文档生成类型
export interface DocumentationSection {
  title: string;
  content: string;
  order: number;
}

export interface DocumentationOptions {
  format: 'markdown' | 'html' | 'pdf';
  includeCode: boolean;
  includeDiagrams: boolean;
}

export enum Language {
  EN = 'en-US',
  ZH_CN = 'zh-CN',
}

// plan.md based types

export interface RepoConfig {
  root: string;
  ignoreDirs: string[];
  ignoreGlobs: string[];
  maxFileMB: number;
  langPriorities: string[];
  exts: string[];
}

export interface Module {
  path: string;
  role: string;
  examples: string[];
}

export interface TechStack {
  type: 'language' | 'framework' | 'db' | 'runtime' | 'build';
  name: string;
  evidence: string[];
}

export interface EntryCandidate {
  path: string;
  why: string;
}

export interface ProjectOverview {
  modules: Module[];
  techStack: TechStack[];
  entryCandidates: EntryCandidate[];
  notes: string[];
}

export interface ModuleGraphEdge {
  from: string;
  to: string;
  type: 'import' | 'runtime' | 'io';
}

export interface CallGraphEdge {
  caller: string;
  callee: string;
  file: string;
  line: number;
}

export interface Hotspot {
  symbol: string;
  fanIn: number;
  fanOut: number;
  files: string[];
}

export interface DependencyGraph {
  moduleGraph: ModuleGraphEdge[];
  callGraph: CallGraphEdge[];
  hotspots: Hotspot[];
  visual: {
    moduleMermaid: string;
    callMermaid: string;
  };
}

export interface CoreFeature {
  id: string;
  name: string;
  whyCore: string;
  importance: number;
  evidence: string[];
  entryPoints: string[];
  primaryModules: string[];
  keySymbols: string[];
}

export interface CoreFeatures {
  features: CoreFeature[];
  rankingRule: string;
}

export interface FeatureDocIndex {
  id: string;
  title: string;
  summary?: string;
  files?: string[];
  symbols?: string[];
  artifacts: {
    type: 'md';
    name: string;
  }[];
}

export interface SiteIndexEntry {
  title: string;
  path: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  questionLike: string[];
  answer: string;
  source: {
    file: string;
    lines: [number, number];
  };
}

// a/service/analysis-orchestrator.ts
// 分析配置
export interface AnalysisConfig {
  llmConfig: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string | string[];
    model: string;
    baseURL?: string;
    temperature?: number;
  };
  analysisType: 'full' | 'structure' | 'quality' | 'security' | 'documentation';
  maxFileSize?: number;
  maxFilesToAnalyze?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

// 分析进度回调
export interface AnalysisProgress {
  stage: string;
  progress: number;
  details?: string;
}
