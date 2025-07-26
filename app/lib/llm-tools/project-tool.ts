import fs from 'fs-extra'
import path from 'path'
import { LLMTool, ToolResult } from '@/app/types'
import { getLanguageFromExtension } from '@/app/lib/utils'

// 项目结构信息
export interface ProjectStructure {
  rootPath: string
  directories: DirectoryInfo[]
  keyFiles: KeyFile[]
  languages: Record<string, number>
  totalFiles: number
  totalDirectories: number
  totalSize: number
}

export interface DirectoryInfo {
  path: string
  name: string
  fileCount: number
  directoryCount: number
  totalSize: number
  depth: number
}

export interface KeyFile {
  path: string
  name: string
  type: 'config' | 'package' | 'readme' | 'main' | 'test' | 'docker' | 'ci' | 'env' | 'docs'
  description: string
  language?: string
}

// 入口点信息
export interface EntryPoint {
  path: string
  type: 'main' | 'index' | 'server' | 'app' | 'cli' | 'test'
  description: string
  framework?: string
  language: string
}

// 包信息
export interface PackageInfo {
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  keywords?: string[]
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
  engines?: Record<string, string>
}

// 依赖关系图
export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
}

export interface DependencyNode {
  id: string
  name: string
  type: 'internal' | 'external' | 'builtin'
  version?: string
  filePath?: string
}

export interface DependencyEdge {
  from: string
  to: string
  type: 'import' | 'require' | 'reference'
  strength: number
}

export class ProjectTool implements LLMTool {
  name = 'project_analysis'
  description = '项目理解工具，用于分析项目结构、入口点、依赖关系和配置文件'
  parameters = [
    {
      name: 'action',
      type: 'string' as const,
      description: '操作类型：structure, entry_points, package_info, dependencies',
      required: true,
    },
    {
      name: 'options',
      type: 'string' as const,
      description: '分析选项（JSON字符串格式）',
      required: false,
    },
  ]

  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, options = {} } = params

    try {
      switch (action) {
        case 'structure':
          return {
            success: true,
            data: await this.getProjectStructure(options)
          }

        case 'entry_points':
          return {
            success: true,
            data: await this.findEntryPoints(options)
          }

        case 'package_info':
          return {
            success: true,
            data: await this.getPackageInfo()
          }

        case 'dependencies':
          return {
            success: true,
            data: await this.analyzeDependencies(options)
          }

        default:
          return {
            success: false,
            error: `不支持的操作: ${action}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async getProjectStructure(options: any = {}): Promise<ProjectStructure> {
    const { maxDepth = 5, exclude = ['node_modules', '.git', '.next', 'dist', 'build'] } = options

    const structure: ProjectStructure = {
      rootPath: this.basePath,
      directories: [],
      keyFiles: [],
      languages: {},
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0
    }

    const stats = await this.analyzeDirectory(this.basePath, 0, maxDepth, exclude)
    structure.directories = stats.directories
    structure.keyFiles = await this.findKeyFiles()
    structure.languages = stats.languages
    structure.totalFiles = stats.totalFiles
    structure.totalDirectories = stats.totalDirectories
    structure.totalSize = stats.totalSize

    return structure
  }

  async findEntryPoints(options: any = {}): Promise<EntryPoint[]> {
    const entryPoints: EntryPoint[] = []

    // 查找常见入口点
    const entryPatterns = [
      { pattern: 'index.*', type: 'index' as const, description: '项目入口文件' },
      { pattern: 'main.*', type: 'main' as const, description: '主程序文件' },
      { pattern: 'server.*', type: 'server' as const, description: '服务器入口文件' },
      { pattern: 'app.*', type: 'app' as const, description: '应用程序入口' },
      { pattern: 'cli.*', type: 'cli' as const, description: '命令行接口' },
      { pattern: 'test.*', type: 'test' as const, description: '测试入口文件' },
    ]

    for (const { pattern, type, description } of entryPatterns) {
      const matches = await this.findFilesByPattern(pattern)
      for (const filePath of matches) {
        const language = getLanguageFromExtension(filePath)
        const framework = await this.detectFramework(filePath)

        entryPoints.push({
          path: filePath,
          type,
          description,
          framework,
          language
        })
      }
    }

    // 查找框架特定的入口点
    const frameworkEntries = await this.findFrameworkEntryPoints()
    entryPoints.push(...frameworkEntries)

    return entryPoints.sort((a, b) => a.path.localeCompare(b.path))
  }

  async getPackageInfo(): Promise<PackageInfo | null> {
    const packageFiles = [
      'package.json',
      'pyproject.toml',
      'requirements.txt',
      'pom.xml',
      'build.gradle',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'Gemfile',
      'pubspec.yaml'
    ]

    for (const fileName of packageFiles) {
      const filePath = path.join(this.basePath, fileName)
      if (await fs.pathExists(filePath)) {
        return await this.parsePackageFile(filePath, fileName)
      }
    }

    return null
  }

  async analyzeDependencies(options: any = {}): Promise<DependencyGraph> {
    const { includeDev = true, maxDepth = 3 } = options

    const graph: DependencyGraph = {
      nodes: [],
      edges: []
    }

    const packageInfo = await this.getPackageInfo()
    if (packageInfo) {
      // 添加包依赖节点
      Object.entries(packageInfo.dependencies).forEach(([name, version]) => {
        graph.nodes.push({
          id: name,
          name,
          type: 'external',
          version
        })
      })

      if (includeDev) {
        Object.entries(packageInfo.devDependencies).forEach(([name, version]) => {
          graph.nodes.push({
            id: name,
            name,
            type: 'external',
            version
          })
        })
      }
    }

    // 分析内部依赖
    const internalDeps = await this.analyzeInternalDependencies()
    graph.nodes.push(...internalDeps.nodes)
    graph.edges.push(...internalDeps.edges)

    return graph
  }

  private async analyzeDirectory(
    dirPath: string,
    depth: number,
    maxDepth: number,
    exclude: string[]
  ): Promise<{
    directories: DirectoryInfo[]
    languages: Record<string, number>
    totalFiles: number
    totalDirectories: number
    totalSize: number
  }> {
    const directories: DirectoryInfo[] = []
    const languages: Record<string, number> = {}
    let totalFiles = 0
    let totalDirectories = 0
    let totalSize = 0

    if (depth > maxDepth) {
      return { directories, languages, totalFiles, totalDirectories, totalSize }
    }

    const items = await fs.readdir(dirPath, { withFileTypes: true })

    for (const item of items) {
      if (exclude.includes(item.name)) continue

      const itemPath = path.join(dirPath, item.name)
      const relativePath = path.relative(this.basePath, itemPath)

      if (item.isDirectory()) {
        totalDirectories++

        const dirInfo = await this.analyzeDirectory(itemPath, depth + 1, maxDepth, exclude)
        directories.push({
          path: relativePath,
          name: item.name,
          fileCount: dirInfo.totalFiles,
          directoryCount: dirInfo.totalDirectories,
          totalSize: dirInfo.totalSize,
          depth
        })

        // 合并统计
        Object.entries(dirInfo.languages).forEach(([lang, count]) => {
          languages[lang] = (languages[lang] || 0) + count
        })
        totalFiles += dirInfo.totalFiles
        totalDirectories += dirInfo.totalDirectories
        totalSize += dirInfo.totalSize
      } else if (item.isFile()) {
        const stats = await fs.stat(itemPath)
        const language = getLanguageFromExtension(item.name)

        languages[language] = (languages[language] || 0) + 1
        totalFiles++
        totalSize += stats.size
      }
    }

    return { directories, languages, totalFiles, totalDirectories, totalSize }
  }

  private async findKeyFiles(): Promise<KeyFile[]> {
    const keyFiles: KeyFile[] = []
    const keyPatterns = [
      // 配置文件
      { pattern: 'package.json', type: 'package' as const, description: 'Node.js项目配置' },
      { pattern: 'pyproject.toml', type: 'package' as const, description: 'Python项目配置' },
      { pattern: 'requirements.txt', type: 'package' as const, description: 'Python依赖文件' },
      { pattern: 'pom.xml', type: 'package' as const, description: 'Maven项目配置' },
      { pattern: 'build.gradle', type: 'package' as const, description: 'Gradle项目配置' },
      { pattern: 'Cargo.toml', type: 'package' as const, description: 'Rust项目配置' },
      { pattern: 'go.mod', type: 'package' as const, description: 'Go模块配置' },
      { pattern: 'composer.json', type: 'package' as const, description: 'PHP项目配置' },
      { pattern: 'Gemfile', type: 'package' as const, description: 'Ruby项目配置' },
      
      // 配置文件
      { pattern: '*.config.js', type: 'config' as const, description: '配置文件' },
      { pattern: '*.config.ts', type: 'config' as const, description: 'TypeScript配置文件' },
      { pattern: 'webpack.config.js', type: 'config' as const, description: 'Webpack配置' },
      { pattern: 'vite.config.*', type: 'config' as const, description: 'Vite配置' },
      { pattern: 'next.config.*', type: 'config' as const, description: 'Next.js配置' },
      { pattern: 'tailwind.config.*', type: 'config' as const, description: 'Tailwind配置' },
      { pattern: 'tsconfig.json', type: 'config' as const, description: 'TypeScript配置' },
      { pattern: 'eslintrc*', type: 'config' as const, description: 'ESLint配置' },
      { pattern: 'prettierrc*', type: 'config' as const, description: 'Prettier配置' },
      
      // Docker
      { pattern: 'Dockerfile', type: 'docker' as const, description: 'Docker镜像配置' },
      { pattern: 'docker-compose.yml', type: 'docker' as const, description: 'Docker Compose配置' },
      
      // CI/CD
      { pattern: '.github/workflows/*', type: 'ci' as const, description: 'GitHub Actions工作流' },
      { pattern: '.gitlab-ci.yml', type: 'ci' as const, description: 'GitLab CI配置' },
      { pattern: 'Jenkinsfile', type: 'ci' as const, description: 'Jenkins配置' },
      
      // 环境文件
      { pattern: '.env*', type: 'env' as const, description: '环境变量配置' },
      { pattern: '.env.example', type: 'env' as const, description: '环境变量示例' },
      
      // 文档
      { pattern: 'README*', type: 'readme' as const, description: '项目说明文档' },
      { pattern: 'CHANGELOG*', type: 'docs' as const, description: '变更日志' },
      { pattern: 'LICENSE*', type: 'docs' as const, description: '许可证文件' },
      { pattern: 'docs/*', type: 'docs' as const, description: '项目文档' },
      
      // 测试文件
      { pattern: '*test*', type: 'test' as const, description: '测试文件' },
      { pattern: '*spec*', type: 'test' as const, description: '测试规范' },
      { pattern: 'jest.config.*', type: 'test' as const, description: 'Jest配置' },
    ]

    for (const { pattern, type, description } of keyPatterns) {
      const matches = await this.findFilesByPattern(pattern)
      for (const filePath of matches) {
        const language = getLanguageFromExtension(filePath)
        keyFiles.push({
          path: filePath,
          name: path.basename(filePath),
          type,
          description,
          language
        })
      }
    }

    return keyFiles.sort((a, b) => a.path.localeCompare(b.path))
  }

  private async findFrameworkEntryPoints(): Promise<EntryPoint[]> {
    const entryPoints: EntryPoint[] = []

    // Next.js
    if (await fs.pathExists(path.join(this.basePath, 'pages'))) {
      entryPoints.push({
        path: 'pages',
        type: 'app',
        description: 'Next.js页面路由',
        framework: 'Next.js',
        language: 'TypeScript'
      })
    }

    // Express.js
    if (await fs.pathExists(path.join(this.basePath, 'app.js')) || 
        await fs.pathExists(path.join(this.basePath, 'server.js'))) {
      entryPoints.push({
        path: 'app.js',
        type: 'server',
        description: 'Express.js服务器入口',
        framework: 'Express.js',
        language: 'JavaScript'
      })
    }

    // React
    if (await fs.pathExists(path.join(this.basePath, 'src', 'index.js')) ||
        await fs.pathExists(path.join(this.basePath, 'src', 'App.js'))) {
      entryPoints.push({
        path: 'src/index.js',
        type: 'app',
        description: 'React应用入口',
        framework: 'React',
        language: 'JavaScript'
      })
    }

    // Vue
    if (await fs.pathExists(path.join(this.basePath, 'src', 'main.js'))) {
      entryPoints.push({
        path: 'src/main.js',
        type: 'app',
        description: 'Vue应用入口',
        framework: 'Vue.js',
        language: 'JavaScript'
      })
    }

    return entryPoints
  }

  private async detectFramework(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(path.join(this.basePath, filePath), 'utf-8')
      
      if (content.includes('React')) return 'React'
      if (content.includes('Vue')) return 'Vue.js'
      if (content.includes('Angular')) return 'Angular'
      if (content.includes('Express')) return 'Express.js'
      if (content.includes('FastAPI')) return 'FastAPI'
      if (content.includes('Flask')) return 'Flask'
      if (content.includes('Django')) return 'Django'
      if (content.includes('Spring')) return 'Spring'
      
      return undefined
    } catch {
      return undefined
    }
  }

  private async parsePackageFile(filePath: string, fileName: string): Promise<PackageInfo> {
    const fullPath = path.join(this.basePath, filePath)
    
    switch (fileName) {
      case 'package.json':
        return await this.parsePackageJson(fullPath)
      case 'pyproject.toml':
        return await this.parsePyProjectToml(fullPath)
      case 'requirements.txt':
        return await this.parseRequirementsTxt(fullPath)
      case 'pom.xml':
        return await this.parsePomXml(fullPath)
      case 'build.gradle':
        return await this.parseBuildGradle(fullPath)
      case 'Cargo.toml':
        return await this.parseCargoToml(fullPath)
      case 'go.mod':
        return await this.parseGoMod(fullPath)
      case 'composer.json':
        return await this.parseComposerJson(fullPath)
      case 'Gemfile':
        return await this.parseGemfile(fullPath)
      default:
        throw new Error(`不支持的包文件格式: ${fileName}`)
    }
  }

  private async parsePackageJson(filePath: string): Promise<PackageInfo> {
    const content = await fs.readJson(filePath)
    return {
      name: content.name || '',
      version: content.version || '0.0.0',
      description: content.description,
      author: content.author,
      license: content.license,
      keywords: content.keywords || [],
      dependencies: content.dependencies || {},
      devDependencies: content.devDependencies || {},
      scripts: content.scripts || {},
      engines: content.engines
    }
  }

  private async parsePyProjectToml(filePath: string): Promise<PackageInfo> {
    // 简化的TOML解析
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    
    const info: PackageInfo = {
      name: '',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }

    // 这里应该使用实际的TOML解析器，简化处理
    lines.forEach(line => {
      const nameMatch = line.match(/name\s*=\s*["']([^"']+)["']/)
      const versionMatch = line.match(/version\s*=\s*["']([^"']+)["']/)
      
      if (nameMatch) info.name = nameMatch[1]
      if (versionMatch) info.version = versionMatch[1]
    })

    return info
  }

  private async parseRequirementsTxt(filePath: string): Promise<PackageInfo> {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const dependencies: Record<string, string> = {}

    lines.forEach(line => {
      const match = line.match(/^([\w-]+)(?:[=<>]=?(.+))?/)
      if (match) {
        dependencies[match[1]] = match[2] || 'latest'
      }
    })

    return {
      name: '',
      version: '0.0.0',
      dependencies,
      devDependencies: {},
      scripts: {}
    }
  }

  private async parsePomXml(filePath: string): Promise<PackageInfo> {
    // 简化的XML解析
    const content = await fs.readFile(filePath, 'utf-8')
    
    const nameMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/)
    const versionMatch = content.match(/<version>([^<]+)<\/version>/)
    
    return {
      name: nameMatch?.[1] || '',
      version: versionMatch?.[1] || '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }
  }

  private async parseBuildGradle(filePath: string): Promise<PackageInfo> {
    // 简化的Gradle解析
    const content = await fs.readFile(filePath, 'utf-8')
    
    return {
      name: '',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }
  }

  private async parseCargoToml(filePath: string): Promise<PackageInfo> {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    
    const info: PackageInfo = {
      name: '',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }

    lines.forEach(line => {
      const nameMatch = line.match(/name\s*=\s*"([^"]+)"/)
      const versionMatch = line.match(/version\s*=\s*"([^"]+)"/)
      
      if (nameMatch) info.name = nameMatch[1]
      if (versionMatch) info.version = versionMatch[1]
    })

    return info
  }

  private async parseGoMod(filePath: string): Promise<PackageInfo> {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    
    const moduleMatch = lines[0]?.match(/module\s+(\S+)/)
    
    return {
      name: moduleMatch?.[1] || '',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }
  }

  private async parseComposerJson(filePath: string): Promise<PackageInfo> {
    const content = await fs.readJson(filePath)
    return {
      name: content.name || '',
      version: content.version || '0.0.0',
      description: content.description,
      dependencies: content.require || {},
      devDependencies: content['require-dev'] || {},
      scripts: content.scripts || {}
    }
  }

  private async parseGemfile(filePath: string): Promise<PackageInfo> {
    const content = await fs.readFile(filePath, 'utf-8')
    
    return {
      name: '',
      version: '0.0.0',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    }
  }

  private async analyzeInternalDependencies(): Promise<{
    nodes: DependencyNode[]
    edges: DependencyEdge[]
  }> {
    const nodes: DependencyNode[] = []
    const edges: DependencyEdge[] = []
    
    // 这里应该实现实际的依赖分析
    // 简化版本返回空结果
    return { nodes, edges }
  }

  private async findFilesByPattern(pattern: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      if (pattern.includes('*')) {
        // 使用glob模式匹配
        const glob = require('glob')
        const matches = glob.sync(pattern, { cwd: this.basePath, nodir: true })
        files.push(...matches)
      } else {
        // 精确匹配
        const filePath = path.join(this.basePath, pattern)
        if (await fs.pathExists(filePath)) {
          files.push(pattern)
        }
      }
    } catch (error) {
      console.warn(`查找文件模式 ${pattern} 时出错:`, error)
    }

    return files
  }
}