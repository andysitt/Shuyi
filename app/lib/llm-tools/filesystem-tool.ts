import fs from 'fs-extra'
import path from 'path'
import { LLMTool, ToolResult } from '@/app/types'
import { getLanguageFromExtension } from '@/app/lib/utils'

export interface DirectoryListing {
  path: string
  files: FileInfo[]
  directories: DirectoryInfo[]
  stats: {
    totalFiles: number
    totalDirectories: number
    totalSize: number
  }
}

export interface FileInfo {
  name: string
  path: string
  size: number
  language?: string
  lastModified: Date
  isBinary?: boolean
}

export interface DirectoryInfo {
  name: string
  path: string
  fileCount: number
  directoryCount: number
  totalSize: number
}

export interface FileContent {
  filePath: string
  content: string
  size: number
  language?: string
  lineCount: number
  truncated: boolean
  metadata: {
    lastModified: Date
    isBinary: boolean
  }
}

export interface ReadOptions {
  maxLines?: number
  offset?: number
  includeMetadata?: boolean
  detectLanguage?: boolean
}

export interface SearchOptions {
  pattern: string
  include?: string[]
  exclude?: string[]
  caseSensitive?: boolean
  maxResults?: number
}

export interface SearchResult {
  filePath: string
  lineNumber: number
  content: string
  context?: string
}

export interface FileStats {
  path: string
  size: number
  isDirectory: boolean
  isFile: boolean
  lastModified: Date
  created: Date
  permissions: string
}

export class FileSystemTool implements LLMTool {
  name = 'filesystem'
  description = '文件系统操作工具，用于浏览、读取和分析代码文件'
  parameters = [
    {
      name: 'action',
      type: 'string' as const,
      description: '操作类型：list, read, search, stats',
      required: true,
    },
    {
      name: 'path',
      type: 'string' as const,
      description: '文件或目录路径',
      required: true,
    },
    {
      name: 'options',
      type: 'string' as const,
      description: '操作选项（JSON字符串格式）',
      required: false,
    },
  ]

  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.basePath, filePath)
    
    // 安全检查：确保路径在basePath范围内
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('路径超出允许范围')
    }
    
    return resolved
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, path: filePath, options = {} } = params

    try {
      switch (action) {
        case 'list':
          return {
            success: true,
            data: await this.listDirectory(filePath)
          }
        
        case 'read':
          return {
            success: true,
            data: await this.readFile(filePath, options)
          }
        
        case 'search':
          return {
            success: true,
            data: await this.searchFiles(filePath, options)
          }
        
        case 'stats':
          return {
            success: true,
            data: await this.getFileStats(filePath)
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

  private async listDirectory(dirPath: string): Promise<DirectoryListing> {
    const fullPath = this.resolvePath(dirPath)
    
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`目录不存在: ${dirPath}`)
    }

    const stats = await fs.stat(fullPath)
    if (!stats.isDirectory()) {
      throw new Error(`路径不是目录: ${dirPath}`)
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true })
    const files: FileInfo[] = []
    const directories: DirectoryInfo[] = []
    let totalFiles = 0
    let totalDirectories = 0
    let totalSize = 0

    for (const item of items) {
      const itemPath = path.join(fullPath, item.name)
      const relativePath = path.relative(this.basePath, itemPath)

      if (item.isFile()) {
        const fileStats = await fs.stat(itemPath)
        const isBinary = await this.isBinaryFile(itemPath)
        
        files.push({
          name: item.name,
          path: relativePath,
          size: fileStats.size,
          language: !isBinary ? getLanguageFromExtension(item.name) : undefined,
          lastModified: fileStats.mtime,
          isBinary
        })
        
        totalFiles++
        totalSize += fileStats.size
      } else if (item.isDirectory()) {
        const dirInfo = await this.getDirectoryInfo(itemPath)
        
        directories.push({
          name: item.name,
          path: relativePath,
          fileCount: dirInfo.fileCount,
          directoryCount: dirInfo.directoryCount,
          totalSize: dirInfo.totalSize
        })
        
        totalDirectories++
        totalSize += dirInfo.totalSize
      }
    }

    return {
      path: dirPath,
      files: files.sort((a, b) => a.name.localeCompare(b.name)),
      directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
      stats: {
        totalFiles,
        totalDirectories,
        totalSize
      }
    }
  }

  private async readFile(filePath: string, options: ReadOptions = {}): Promise<FileContent> {
    const fullPath = this.resolvePath(filePath)
    
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    const stats = await fs.stat(fullPath)
    if (!stats.isFile()) {
      throw new Error(`路径不是文件: ${filePath}`)
    }

    const isBinary = await this.isBinaryFile(fullPath)
    
    if (isBinary) {
      return {
        filePath,
        content: '<二进制文件，无法显示内容>',
        size: stats.size,
        lineCount: 0,
        truncated: false,
        metadata: {
          lastModified: stats.mtime,
          isBinary: true
        }
      }
    }

    let content = await fs.readFile(fullPath, 'utf-8')
    const originalLineCount = content.split('\n').length
    
    let truncated = false

    // 应用偏移和行数限制
    if (options.offset) {
      const lines = content.split('\n')
      content = lines.slice(options.offset).join('\n')
    }

    if (options.maxLines) {
      const lines = content.split('\n')
      if (lines.length > options.maxLines) {
        content = lines.slice(0, options.maxLines).join('\n')
        truncated = true
      }
    }

    // 文件大小限制（1MB）
    const maxSize = 1024 * 1024
    if (content.length > maxSize) {
      content = content.substring(0, maxSize) + '\n... [文件过大，已截断]'
      truncated = true
    }

    return {
      filePath,
      content,
      size: stats.size,
      language: options.detectLanguage !== false ? getLanguageFromExtension(filePath) : undefined,
      lineCount: originalLineCount,
      truncated,
      metadata: {
        lastModified: stats.mtime,
        isBinary: false
      }
    }
  }

  private async searchFiles(basePath: string, options: SearchOptions): Promise<SearchResult[]> {
    const fullPath = this.resolvePath(basePath)
    const results: SearchResult[] = []
    
    const {
      pattern,
      include = ['**/*'],
      exclude = ['node_modules/**', '.git/**', '*.min.js', '*.min.css'],
      caseSensitive = false,
      maxResults = 100
    } = options

    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')

    const self = this
    async function searchInDirectory(dirPath: string): Promise<void> {
      if (results.length >= maxResults) return

      const items = await fs.readdir(dirPath, { withFileTypes: true })

      for (const item of items) {
        if (results.length >= maxResults) break

        const itemPath = path.join(dirPath, item.name)
        const relativePath = path.relative(fullPath, itemPath)

        // 检查排除模式
        const shouldExclude = exclude.some(excludePattern => 
          self.matchesPattern(relativePath, excludePattern)
        )
        if (shouldExclude) continue

        // 检查包含模式
        const shouldInclude = include.some(includePattern => 
          self.matchesPattern(relativePath, includePattern)
        )
        if (!shouldInclude) continue

        if (item.isFile()) {
          try {
            const content = await fs.readFile(itemPath, 'utf-8')
            const lines = content.split('\n')
            
            lines.forEach((line, index) => {
              if (results.length >= maxResults) return
              
              if (regex.test(line)) {
                results.push({
                  filePath: relativePath,
                  lineNumber: index + 1,
                  content: line.trim(),
                  context: self.getContext(lines, index)
                })
              }
            })
          } catch (error) {
            // 跳过无法读取的文件
          }
        } else if (item.isDirectory()) {
          await searchInDirectory(itemPath)
        }
      }
    }

    await searchInDirectory(fullPath)
    return results.slice(0, maxResults)
  }

  private async getFileStats(filePath: string): Promise<FileStats> {
    const fullPath = this.resolvePath(filePath)
    
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`路径不存在: ${filePath}`)
    }

    const stats = await fs.stat(fullPath)
    const mode = stats.mode
    const permissions = [
      (mode & parseInt('400', 8)) ? 'r' : '-',
      (mode & parseInt('200', 8)) ? 'w' : '-',
      (mode & parseInt('100', 8)) ? 'x' : '-',
      (mode & parseInt('040', 8)) ? 'r' : '-',
      (mode & parseInt('020', 8)) ? 'w' : '-',
      (mode & parseInt('010', 8)) ? 'x' : '-',
      (mode & parseInt('004', 8)) ? 'r' : '-',
      (mode & parseInt('002', 8)) ? 'w' : '-',
      (mode & parseInt('001', 8)) ? 'x' : '-',
    ].join('')

    return {
      path: filePath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      lastModified: stats.mtime,
      created: stats.birthtime,
      permissions
    }
  }

  private async getDirectoryInfo(dirPath: string): Promise<{
    fileCount: number
    directoryCount: number
    totalSize: number
  }> {
    let fileCount = 0
    let directoryCount = 0
    let totalSize = 0

    const items = await fs.readdir(dirPath, { withFileTypes: true })

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name)
      
      if (item.isFile()) {
        const stats = await fs.stat(itemPath)
        fileCount++
        totalSize += stats.size
      } else if (item.isDirectory()) {
        directoryCount++
        const subDirInfo = await this.getDirectoryInfo(itemPath)
        fileCount += subDirInfo.fileCount
        directoryCount += subDirInfo.directoryCount
        totalSize += subDirInfo.totalSize
      }
    }

    return { fileCount, directoryCount, totalSize }
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath)
      
      // 检查null字节（二进制文件的标志）
      for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
        if (buffer[i] === 0) {
          return true
        }
      }

      // 检查非文本字符比例
      let textChars = 0
      let totalChars = 0

      for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
        const byte = buffer[i]
        if (byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
          textChars++
        }
        totalChars++
      }

      return textChars / totalChars < 0.9
    } catch {
      return false
    }
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp(
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    )
    return regex.test(filePath)
  }

  private getContext(lines: string[], lineIndex: number, contextLines = 2): string {
    const start = Math.max(0, lineIndex - contextLines)
    const end = Math.min(lines.length, lineIndex + contextLines + 1)
    
    return lines.slice(start, end).join('\n')
  }
}