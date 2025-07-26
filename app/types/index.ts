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
  llmInsights: LLMInsights;
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