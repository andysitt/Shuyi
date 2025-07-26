import fs from 'fs-extra'
import path from 'path'
import { LLMTool, ToolResult } from '@/app/types'
import { getLanguageFromExtension } from '@/app/lib/utils'

// 基础AST节点接口
export interface ASTNode {
  type: string
  name?: string
  start?: { line: number; column: number }
  end?: { line: number; column: number }
  children?: ASTNode[]
  properties?: Record<string, any>
}

// 符号信息
export interface SymbolInfo {
  name: string
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant' | 'type' | 'enum'
  filePath: string
  line: number
  column: number
  signature?: string
  documentation?: string
  visibility?: 'public' | 'private' | 'protected' | 'internal'
}

// 引用信息
export interface Reference {
  filePath: string
  line: number
  column: number
  type: 'import' | 'call' | 'usage' | 'definition'
  context?: string
}

// 依赖信息
export interface Dependency {
  name: string
  type: 'import' | 'require' | 'export' | 'reference'
  filePath: string
  line: number
  isExternal: boolean
  version?: string
}

// 复杂度指标
export interface ComplexityMetrics {
  cyclomaticComplexity: number
  cognitiveComplexity: number
  linesOfCode: number
  maintainabilityIndex: number
  halsteadMetrics?: {
    operators: {
      total: number
      distinct: number
    }
    operands: {
      total: number
      distinct: number
    }
    vocabulary: number
    length: number
    volume: number
    difficulty: number
    effort: number
  }
}

export class CodeAnalysisTool implements LLMTool {
  name = 'code_analysis'
  description = '代码分析工具，用于解析AST、查找符号、分析复杂度和依赖关系'
  parameters = [
    {
      name: 'action',
      type: 'string' as const,
      description: '操作类型：parse, find_symbols, find_references, analyze_complexity, get_dependencies',
      required: true,
    },
    {
      name: 'filePath',
      type: 'string' as const,
      description: '目标文件路径',
      required: true,
    },
    {
      name: 'symbol',
      type: 'string' as const,
      description: '要查找的符号名称（用于find_symbols和find_references）',
      required: false,
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

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.basePath, filePath)
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('路径超出允许范围')
    }
    return resolved
  }

  async execute(params: any): Promise<ToolResult> {
    const { action, filePath, symbol, options = {} } = params

    try {
      const fullPath = this.resolvePath(filePath)

      if (!(await fs.pathExists(fullPath))) {
        return {
          success: false,
          error: `文件不存在: ${filePath}`
        }
      }

      switch (action) {
        case 'parse':
          return {
            success: true,
            data: await this.parseAST(filePath)
          }

        case 'find_symbols':
          return {
            success: true,
            data: await this.findSymbols(filePath, options)
          }

        case 'find_references':
          return {
            success: true,
            data: await this.findReferences(filePath, symbol)
          }

        case 'analyze_complexity':
          return {
            success: true,
            data: await this.analyzeComplexity(filePath)
          }

        case 'get_dependencies':
          return {
            success: true,
            data: await this.getDependencies(filePath)
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

  async parseAST(filePath: string): Promise<ASTNode> {
    const language = getLanguageFromExtension(filePath)
    const content = await fs.readFile(this.resolvePath(filePath), 'utf-8')

    switch (language) {
      case 'JavaScript':
      case 'TypeScript':
        return this.parseJavaScriptAST(content, filePath)
      case 'Python':
        return this.parsePythonAST(content, filePath)
      case 'Java':
        return this.parseJavaAST(content, filePath)
      case 'Python':
        return this.parsePythonAST(content, filePath)
      default:
        return this.parseGenericAST(content, filePath)
    }
  }

  async findSymbols(filePath: string, options: any = {}): Promise<SymbolInfo[]> {
    const language = getLanguageFromExtension(filePath)
    const content = await fs.readFile(this.resolvePath(filePath), 'utf-8')

    switch (language) {
      case 'JavaScript':
      case 'TypeScript':
        return this.findJavaScriptSymbols(content, filePath, options)
      case 'Python':
        return this.findPythonSymbols(content, filePath, options)
      case 'Java':
        return this.findJavaSymbols(content, filePath, options)
      default:
        return this.findGenericSymbols(content, filePath, options)
    }
  }

  async findReferences(filePath: string, symbol: string): Promise<Reference[]> {
    const language = getLanguageFromExtension(filePath)
    const content = await fs.readFile(this.resolvePath(filePath), 'utf-8')

    const references: Reference[] = []
    const lines = content.split('\n')

    // 基于语言的引用查找
    if (['JavaScript', 'TypeScript'].includes(language)) {
      this.findJavaScriptReferences(lines, filePath, symbol, references)
    } else if (language === 'Python') {
      this.findPythonReferences(lines, filePath, symbol, references)
    } else if (language === 'Java') {
      this.findJavaReferences(lines, filePath, symbol, references)
    } else {
      this.findGenericReferences(lines, filePath, symbol, references)
    }

    return references
  }

  async analyzeComplexity(filePath: string): Promise<ComplexityMetrics> {
    const language = getLanguageFromExtension(filePath)
    const content = await fs.readFile(this.resolvePath(filePath), 'utf-8')

    const lines = content.split('\n')
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')).length

    let cyclomaticComplexity = 1
    let cognitiveComplexity = 0

    // 基于语言的复杂度分析
    if (['JavaScript', 'TypeScript', 'Java'].includes(language)) {
      const result = this.analyzeJavaScriptComplexity(content)
      cyclomaticComplexity = result.cyclomaticComplexity
      cognitiveComplexity = result.cognitiveComplexity
    } else if (language === 'Python') {
      const result = this.analyzePythonComplexity(content)
      cyclomaticComplexity = result.cyclomaticComplexity
      cognitiveComplexity = result.cognitiveComplexity
    } else {
      const result = this.analyzeGenericComplexity(content)
      cyclomaticComplexity = result.cyclomaticComplexity
      cognitiveComplexity = result.cognitiveComplexity
    }

    const maintainabilityIndex = this.calculateMaintainabilityIndex(linesOfCode, cyclomaticComplexity, cognitiveComplexity)

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      maintainabilityIndex
    }
  }

  async getDependencies(filePath: string): Promise<Dependency[]> {
    const language = getLanguageFromExtension(filePath)
    const content = await fs.readFile(this.resolvePath(filePath), 'utf-8')

    switch (language) {
      case 'JavaScript':
      case 'TypeScript':
        return this.getJavaScriptDependencies(content, filePath)
      case 'Python':
        return this.getPythonDependencies(content, filePath)
      case 'Java':
        return this.getJavaDependencies(content, filePath)
      default:
        return []
    }
  }

  // 具体的解析实现
  private parseJavaScriptAST(content: string, filePath: string): ASTNode {
    // 简化的JavaScript解析
    const lines = content.split('\n')
    const root: ASTNode = {
      type: 'program',
      children: []
    }

    // 查找函数定义
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(.*\)\s*=>))/g
    let match
    while ((match = functionRegex.exec(content)) !== null) {
      root.children?.push({
        type: 'function',
        name: match[1] || match[2],
        start: { line: this.getLineNumber(content, match.index), column: 0 },
        properties: { async: content.substring(match.index, match.index + 50).includes('async') }
      })
    }

    // 查找类定义
    const classRegex = /class\s+(\w+)/g
    while ((match = classRegex.exec(content)) !== null) {
      root.children?.push({
        type: 'class',
        name: match[1],
        start: { line: this.getLineNumber(content, match.index), column: 0 }
      })
    }

    return root
  }

  private parsePythonAST(content: string, filePath: string): ASTNode {
    const lines = content.split('\n')
    const root: ASTNode = {
      type: 'module',
      children: []
    }

    // 查找函数定义
    const functionRegex = /def\s+(\w+)\s*\(/g
    let match
    while ((match = functionRegex.exec(content)) !== null) {
      root.children?.push({
        type: 'function',
        name: match[1],
        start: { line: this.getLineNumber(content, match.index), column: 0 }
      })
    }

    // 查找类定义
    const classRegex = /class\s+(\w+)/g
    while ((match = classRegex.exec(content)) !== null) {
      root.children?.push({
        type: 'class',
        name: match[1],
        start: { line: this.getLineNumber(content, match.index), column: 0 }
      })
    }

    return root
  }

  private parseJavaAST(content: string, filePath: string): ASTNode {
    const root: ASTNode = {
      type: 'compilation_unit',
      children: []
    }

    // 查找类定义
    const classRegex = /(?:public\s+)?(?:class|interface|enum)\s+(\w+)/g
    let match
    while ((match = classRegex.exec(content)) !== null) {
      root.children?.push({
        type: 'class',
        name: match[1],
        start: { line: this.getLineNumber(content, match.index), column: 0 }
      })
    }

    return root
  }

  private parseGenericAST(content: string, filePath: string): ASTNode {
    return {
      type: 'file',
      name: path.basename(filePath),
      properties: {
        size: content.length,
        lines: content.split('\n').length
      }
    }
  }

  // 符号查找实现
  private findJavaScriptSymbols(content: string, filePath: string, options: any): SymbolInfo[] {
    const symbols: SymbolInfo[] = []
    const lines = content.split('\n')

    // 查找函数
    const functionRegex = /(?:function\s+(\w+)|(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(.*\)\s*=>))/g
    let match
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2]
      const line = this.getLineNumber(content, match.index)
      symbols.push({
        name,
        type: 'function',
        filePath,
        line,
        column: 0,
        signature: lines[line - 1]?.trim()
      })
    }

    // 查找类
    const classRegex = /(?:export\s+)?class\s+(\w+)/g
    while ((match = classRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index)
      symbols.push({
        name: match[1],
        type: 'class',
        filePath,
        line,
        column: 0,
        signature: lines[line - 1]?.trim()
      })
    }

    return symbols
  }

  private findPythonSymbols(content: string, filePath: string, options: any): SymbolInfo[] {
    const symbols: SymbolInfo[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const lineNum = index + 1

      // 查找函数
      const funcMatch = line.match(/^\s*def\s+(\w+)/)
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          filePath,
          line: lineNum,
          column: 0,
          signature: line.trim()
        })
      }

      // 查找类
      const classMatch = line.match(/^\s*class\s+(\w+)/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          filePath,
          line: lineNum,
          column: 0,
          signature: line.trim()
        })
      }
    })

    return symbols
  }

  private findJavaSymbols(content: string, filePath: string, options: any): SymbolInfo[] {
    const symbols: SymbolInfo[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const lineNum = index + 1

      // 查找类
      const classMatch = line.match(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          filePath,
          line: lineNum,
          column: 0,
          signature: line.trim()
        })
      }

      // 查找方法
      const methodMatch = line.match(/(?:public|private|protected\s+)?\w+\s+(\w+)\s*\(/)
      if (methodMatch) {
        symbols.push({
          name: methodMatch[1],
          type: 'function',
          filePath,
          line: lineNum,
          column: 0,
          signature: line.trim()
        })
      }
    })

    return symbols
  }

  private findGenericSymbols(content: string, filePath: string, options: any): SymbolInfo[] {
    return []
  }

  // 引用查找实现
  private findJavaScriptReferences(lines: string[], filePath: string, symbol: string, references: Reference[]): void {
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g')

    lines.forEach((line, index) => {
      let match
      while ((match = symbolRegex.exec(line)) !== null) {
        references.push({
          filePath,
          line: index + 1,
          column: match.index + 1,
          type: 'usage',
          context: line.trim()
        })
      }
    })
  }

  private findPythonReferences(lines: string[], filePath: string, symbol: string, references: Reference[]): void {
    this.findJavaScriptReferences(lines, filePath, symbol, references)
  }

  private findJavaReferences(lines: string[], filePath: string, symbol: string, references: Reference[]): void {
    this.findJavaScriptReferences(lines, filePath, symbol, references)
  }

  private findGenericReferences(lines: string[], filePath: string, symbol: string, references: Reference[]): void {
    this.findJavaScriptReferences(lines, filePath, symbol, references)
  }

  // 复杂度分析实现
  private analyzeJavaScriptComplexity(content: string): {
    cyclomaticComplexity: number
    cognitiveComplexity: number
  } {
    let cyclomaticComplexity = 1 // 基础复杂度
    let cognitiveComplexity = 0

    // 计算圈复杂度
    const complexKeywords = /\b(if|else if|case|while|for|do|catch|switch)\b/g
    const matches = content.match(complexKeywords)
    if (matches) {
      cyclomaticComplexity += matches.length
    }

    // 计算认知复杂度
    const nestingKeywords = /\b(if|else|case|while|for|do|catch|switch)\b/g
    const nestingMatches = content.match(nestingKeywords)
    if (nestingMatches) {
      cognitiveComplexity += nestingMatches.length
    }

    return { cyclomaticComplexity, cognitiveComplexity }
  }

  private analyzePythonComplexity(content: string): {
    cyclomaticComplexity: number
    cognitiveComplexity: number
  } {
    return this.analyzeJavaScriptComplexity(content)
  }

  private analyzeGenericComplexity(content: string): {
    cyclomaticComplexity: number
    cognitiveComplexity: number
  } {
    return this.analyzeJavaScriptComplexity(content)
  }

  private calculateMaintainabilityIndex(linesOfCode: number, cyclomaticComplexity: number, cognitiveComplexity: number): number {
    // 简化的可维护性指数计算
    const maxLines = 1000
    const maxComplexity = 50
    
    const linesScore = Math.max(0, 100 - (linesOfCode / maxLines) * 50)
    const complexityScore = Math.max(0, 100 - (cyclomaticComplexity / maxComplexity) * 50)
    const cognitiveScore = Math.max(0, 100 - (cognitiveComplexity / maxComplexity) * 50)

    return Math.round((linesScore + complexityScore + cognitiveScore) / 3)
  }

  // 依赖分析实现
  private getJavaScriptDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = []
    const lines = content.split('\n')

    // import语句
    const importRegex = /import\s+(?:(?:\w+|\{[^}]*\}|\*)\s+from\s+)?['"`]([^'"`]+)['"`]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        type: 'import',
        filePath,
        line: this.getLineNumber(content, match.index),
        isExternal: !match[1].startsWith('.') && !match[1].startsWith('/')
      })
    }

    // require语句
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        type: 'require',
        filePath,
        line: this.getLineNumber(content, match.index),
        isExternal: !match[1].startsWith('.') && !match[1].startsWith('/')
      })
    }

    return dependencies
  }

  private getPythonDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = []
    const lines = content.split('\n')

    // import语句
    const importRegex = /import\s+(\w+)(?:\s+as\s+\w+)?|from\s+(\w+)\s+import/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const moduleName = match[1] || match[2]
      dependencies.push({
        name: moduleName,
        type: 'import',
        filePath,
        line: this.getLineNumber(content, match.index),
        isExternal: !moduleName.startsWith('.')
      })
    }

    return dependencies
  }

  private getJavaDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = []
    const lines = content.split('\n')

    // import语句
    const importRegex = /import\s+([\w.]+)/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        type: 'import',
        filePath,
        line: this.getLineNumber(content, match.index),
        isExternal: !match[1].startsWith('.')
      })
    }

    return dependencies
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }
}