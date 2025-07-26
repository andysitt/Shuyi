import { ToolDefinition } from '@/app/types'

// 提示词模板
export interface PromptTemplate {
  systemPrompt: string
  userPrompt: string
  toolPrompt: string
  contextPrompt: string
}

// 分析目标类型
export type AnalysisGoal = 
  | 'full_analysis'
  | 'code_review'
  | 'documentation'
  | 'security_audit'
  | 'performance_optimization'
  | 'architecture_review'
  | 'learning_guide'

// 提示词构建器
export class PromptBuilder {
  private static readonly SYSTEM_PROMPT = `你是一个专业的代码分析助手，专门帮助用户理解和分析GitHub代码仓库。

你的核心能力：
1. 深度代码分析：使用提供的工具进行代码探索、结构分析和质量评估
2. 技术洞察：识别技术栈、架构模式和最佳实践
3. 安全审计：发现潜在的安全问题和漏洞
4. 文档生成：创建清晰、有用的技术文档
5. 学习指导：为开发者提供代码学习和理解建议

工作原则：
- 始终使用提供的工具来获取准确信息
- 提供具体、可操作的洞察和建议
- 保持客观、专业的分析态度
- 适应用户的分析目标和需求

工具使用规范：
- 优先使用filesystem工具了解项目结构
- 使用project_analysis工具理解项目整体架构
- 使用code_analysis工具深入分析关键代码
- 组合使用多个工具获取全面信息

回答格式：
- 使用清晰的中文描述
- 提供具体的代码示例和文件引用
- 结构化展示分析结果
- 包含优先级排序的建议`

  // 构建分析提示词
  static buildAnalysisPrompt(
    analysisGoal: AnalysisGoal,
    repositoryInfo: {
      name: string
      description: string
      language: string
      stars: number
    }
  ): string {
    const basePrompt = this.getBaseAnalysisPrompt(analysisGoal, repositoryInfo)
    
    return basePrompt
  }

  // 构建工具使用提示词
  static buildToolUsagePrompt(
    availableTools: ToolDefinition[],
    analysisGoal: AnalysisGoal
  ): string {
    const toolsList = availableTools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n')

    return `基于分析目标「${this.getGoalDescription(analysisGoal)}」，

可用的工具包括：
${toolsList}

请根据以下策略选择合适的工具：
${this.getToolStrategy(analysisGoal)}

请按顺序执行工具调用，确保获取完整信息后再进行分析。`
  }

  // 构建结果解释提示词
  static buildResultInterpretationPrompt(
    toolResults: any[],
    analysisGoal: AnalysisGoal
  ): string {
    return `基于以下工具执行结果，请提供详细的分析报告：

${toolResults.map((result, index) => 
  `### 工具${index + 1}结果：
${JSON.stringify(result, null, 2)}
`
).join('\n')}

分析要求：
${this.getAnalysisRequirements(analysisGoal)}

请确保回答：
1. 使用中文进行详细解释
2. 提供具体的代码示例和文件引用
3. 给出优先级排序的改进建议
4. 包含可操作的下一步行动`
  }

  // 构建文档生成提示词
  static buildDocumentationPrompt(
    analysisResults: any,
    documentationType: 'readme' | 'api' | 'architecture' | 'contributing'
  ): string {
    const typePrompt = this.getDocumentationTypePrompt(documentationType)
    
    return `基于以下分析结果，生成${typePrompt.title}：

分析数据：
${JSON.stringify(analysisResults, null, 2)}

生成要求：
${typePrompt.requirements}

格式规范：
- 使用Markdown格式
- 包含必要的代码示例
- 提供清晰的目录结构
- 使用中文描述

请生成完整的文档内容。`
  }

  // 构建安全审计提示词
  static buildSecurityPrompt(analysisResults: any): string {
    return `作为安全专家，请基于以下分析结果进行安全审计：

分析数据：
${JSON.stringify(analysisResults, null, 2)}

安全审计要点：
1. 识别潜在的安全漏洞
2. 检查敏感信息泄露
3. 评估依赖项安全性
4. 分析代码注入风险
5. 检查身份验证和授权机制

输出格式：
- 按严重程度分类问题（高/中/低）
- 提供具体的修复建议
- 给出安全测试建议
- 包含最佳实践指导

请提供详细的安全审计报告。`
  }

  // 构建学习指导提示词
  static buildLearningPrompt(
    repositoryInfo: any,
    userLevel: 'beginner' | 'intermediate' | 'advanced'
  ): string {
    const levelPrompt = this.getLearningLevelPrompt(userLevel)
    
    return `基于以下代码仓库信息，为${levelPrompt.description}开发者创建学习指南：

仓库信息：
${JSON.stringify(repositoryInfo, null, 2)}

学习指南要求：
${levelPrompt.requirements}

内容结构：
1. 项目概述和技术栈介绍
2. 代码结构导航
3. 关键文件和模块解释
4. 学习路径建议
5. 实践练习建议

请提供详细的学习指导。`
  }

  // 私有辅助方法
  private static getBaseAnalysisPrompt(
    goal: AnalysisGoal,
    repoInfo: { name: string; description: string; language: string; stars: number }
  ): string {
    const goalDescription = this.getGoalDescription(goal)
    
    return `开始分析GitHub仓库：${repoInfo.name}

仓库信息：
- 描述：${repoInfo.description}
- 主要语言：${repoInfo.language}
- Star数：${repoInfo.stars}

分析目标：${goalDescription}

请使用提供的工具进行深度分析，重点关注：
${this.getFocusAreas(goal)}`
  }


  private static getGoalDescription(goal: AnalysisGoal): string {
    const descriptions = {
      full_analysis: '全面分析项目结构、代码质量、依赖关系和技术架构',
      code_review: '深入代码质量审查，发现潜在问题和改进机会',
      documentation: '生成项目文档，包括API文档、架构说明等',
      security_audit: '安全审计，识别潜在安全漏洞和风险',
      performance_optimization: '性能分析，找出性能瓶颈和优化建议',
      architecture_review: '架构审查，评估系统设计和技术选型',
      learning_guide: '为开发者提供学习指导和代码理解帮助'
    }
    return descriptions[goal]
  }

  private static getFocusAreas(goal: AnalysisGoal): string {
    const areas = {
      full_analysis: `- 项目整体结构和组织
- 主要技术栈和框架
- 代码质量和复杂度
- 依赖关系和安全性
- 文档完整性`,
      code_review: `- 代码规范和最佳实践
- 潜在的bug和错误
- 性能优化机会
- 可读性和可维护性
- 测试覆盖率`,
      documentation: `- API接口和使用说明
- 架构设计文档
- 部署和配置指南
- 贡献者指南
- 变更日志`,
      security_audit: `- 依赖项安全漏洞
- 敏感信息泄露
- 输入验证和注入风险
- 身份验证和授权
- 安全配置`,
      performance_optimization: `- 性能瓶颈识别
- 资源使用优化
- 缓存策略
- 数据库查询优化
- 前端性能`,
      architecture_review: `- 系统设计合理性
- 技术选型评估
- 扩展性考虑
- 模块化和解耦
- 可维护性`,
      learning_guide: `- 项目背景和用途
- 技术栈介绍
- 代码结构导航
- 关键概念解释
- 学习路径建议`
    }
    return areas[goal]
  }

  private static getToolStrategy(goal: AnalysisGoal): string {
    const strategies = {
      full_analysis: `1. 首先使用filesystem.list了解项目根目录结构
2. 使用project_analysis.structure获取项目整体信息
3. 检查package.json等关键配置文件
4. 分析主要入口文件和核心模块
5. 评估代码质量和复杂度`,
      code_review: `1. 识别关键代码文件
2. 使用code_analysis.analyze_complexity分析复杂度
3. 检查主要函数和类的实现
4. 查找潜在的安全问题
5. 评估测试覆盖率`,
      documentation: `1. 分析项目结构和依赖
2. 识别主要API和接口
3. 检查现有文档
4. 分析配置和部署要求
5. 整理最佳实践`,
      security_audit: `1. 检查依赖项的已知漏洞
2. 分析输入验证和输出编码
3. 检查身份验证机制
4. 评估敏感数据处理
5. 审查安全配置`,
      performance_optimization: `1. 分析代码复杂度
2. 检查资源使用模式
3. 评估数据库查询
4. 分析前端性能
5. 识别缓存机会`,
      architecture_review: `1. 理解项目整体结构
2. 分析模块依赖关系
3. 评估技术选型
4. 检查设计模式使用
5. 评估扩展性策略`,
      learning_guide: `1. 理解项目目标和用途
2. 分析技术栈和框架
3. 梳理代码结构
4. 识别学习重点
5. 提供实践建议`
    }
    return strategies[goal]
  }

  private static getAnalysisRequirements(goal: AnalysisGoal): string {
    const requirements = {
      full_analysis: '请提供全面的项目分析报告，包括技术栈、架构、代码质量、依赖关系等',
      code_review: '请重点关注代码质量、潜在问题和改进建议',
      documentation: '请基于分析结果生成清晰的技术文档',
      security_audit: '请详细说明发现的安全问题和修复建议',
      performance_optimization: '请具体指出性能瓶颈和优化方案',
      architecture_review: '请评估系统设计的合理性和改进空间',
      learning_guide: '请为开发者提供具体的学习指导和建议'
    }
    return requirements[goal]
  }

  private static getDocumentationTypePrompt(type: string): { title: string; requirements: string } {
    const prompts = {
      readme: {
        title: 'README.md',
        requirements: '包含项目介绍、安装指南、使用说明、贡献指南等'
      },
      api: {
        title: 'API文档',
        requirements: '详细说明所有API接口、参数、返回值和示例'
      },
      architecture: {
        title: '架构文档',
        requirements: '描述系统架构、技术选型、模块设计和数据流'
      },
      contributing: {
        title: '贡献指南',
        requirements: '说明如何参与项目、代码规范、提交流程等'
      }
    }
    return prompts[type as keyof typeof prompts] || prompts.readme
  }

  private static getLearningLevelPrompt(level: string): { description: string; requirements: string } {
    const prompts = {
      beginner: {
        description: '初学者',
        requirements: '从基础概念开始，提供详细的代码解释和学习步骤'
      },
      intermediate: {
        description: '中级开发者',
        requirements: '重点解释设计模式和高级概念，提供进阶学习建议'
      },
      advanced: {
        description: '高级开发者',
        requirements: '深入分析架构设计，探讨性能优化和扩展性考虑'
      }
    }
    return prompts[level as keyof typeof prompts]
  }

  // 格式化工具结果用于提示词
  static formatToolResultsForPrompt(results: any[]): string {
    return results.map((result, index) => {
      if (result.success) {
        return `### 工具${index + 1}执行成功
结果：${JSON.stringify(result.data, null, 2)}`
      } else {
        return `### 工具${index + 1}执行失败
错误：${result.error}`
      }
    }).join('\n\n')
  }

  // 构建错误处理提示词
  static buildErrorPrompt(error: string, context?: string): string {
    return `在执行分析过程中遇到了错误：

错误信息：${error}

${context ? `上下文信息：${context}` : ''}

请提供：
1. 错误原因分析
2. 可能的解决方案
3. 替代的分析方法
4. 如何避免类似错误

请用中文详细说明。`
  }
}