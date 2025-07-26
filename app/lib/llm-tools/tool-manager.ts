import { LLMTool, ToolResult, ToolDefinition } from '@/app/types'
import { FileSystemTool } from './filesystem-tool'
import { CodeAnalysisTool } from './code-analysis-tool'
import { ProjectTool } from './project-tool'

export class ToolManager {
  private tools: Map<string, LLMTool> = new Map()
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
    this.initializeTools()
  }

  private initializeTools(): void {
    // 注册所有可用的LLM工具
    this.tools.set('filesystem', new FileSystemTool(this.basePath))
    this.tools.set('code_analysis', new CodeAnalysisTool(this.basePath))
    this.tools.set('project_analysis', new ProjectTool(this.basePath))
  }

  registerTool(tool: LLMTool): void {
    this.tools.set(tool.name, tool)
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        error: `工具 "${name}" 未找到`
      }
    }

    try {
      // 验证参数
      const validationError = this.validateParameters(tool, params)
      if (validationError) {
        return {
          success: false,
          error: validationError
        }
      }

      const result = await tool.execute(params)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async executeMultipleTools(tools: Array<{name: string, params: any}>): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    for (const { name, params } of tools) {
      const result = await this.executeTool(name, params)
      results.push(result)
    }
    
    return results
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  }

  getTool(name: string): LLMTool | undefined {
    return this.tools.get(name)
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  private validateParameters(tool: LLMTool, params: any): string | null {
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        return `缺少必需参数: ${param.name}`
      }

      if (param.name in params) {
        const value = params[param.name]
        const isValidType = this.validateType(value, param.type)
        if (!isValidType) {
          return `参数 ${param.name} 类型错误，期望 ${param.type}`
        }
      }
    }
    return null
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null
      default:
        return true
    }
  }

  // 获取工具使用统计
  getToolStats(): Record<string, number> {
    return {
      totalTools: this.tools.size,
      availableTools: this.getAvailableTools().length
    }
  }
}

// 创建工具管理器实例
export function createToolManager(basePath: string): ToolManager {
  return new ToolManager(basePath)
}

// 全局工具管理器实例
export const globalToolManager = createToolManager(process.cwd())