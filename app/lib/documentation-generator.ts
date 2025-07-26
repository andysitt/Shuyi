import fs from 'fs-extra'
import path from 'path'
import { AnalysisResult, DocumentationSection, DocumentationOptions } from '@/app/types'

// 文档生成器配置
interface DocumentationConfig {
  format: 'markdown' | 'html' | 'pdf'
  includeCode: boolean
  includeDiagrams: boolean
  sections: string[]
  language: 'zh-CN' | 'en-US'
}

// 文档模板
interface DocumentTemplate {
  title: string
  sections: DocumentationSection[]
  metadata: {
    generatedAt: Date
    repository: string
    version: string
  }
}

// 主要文档生成器
export class DocumentationGenerator {
  private config: DocumentationConfig

  constructor(config: Partial<DocumentationConfig> = {}) {
    this.config = {
      format: 'markdown',
      includeCode: true,
      includeDiagrams: true,
      sections: ['overview', 'architecture', 'api', 'setup', 'contributing'],
      language: 'zh-CN',
      ...config
    }
  }

  // 生成完整文档
  async generateDocumentation(
    analysisResult: AnalysisResult,
    outputPath: string,
    options: DocumentationOptions = {
      format: 'markdown',
      includeCode: true,
      includeDiagrams: true
    }
  ): Promise<string> {
    const template = this.createDocumentTemplate(analysisResult)
    const content = this.renderDocument(template, options)
    
    await fs.ensureDir(path.dirname(outputPath))
    await fs.writeFile(outputPath, content, 'utf-8')
    
    return outputPath
  }

  // 创建文档模板
  private createDocumentTemplate(analysisResult: AnalysisResult): DocumentTemplate {
    const sections: DocumentationSection[] = []

    // 项目概览
    sections.push({
      title: '项目概览',
      content: this.generateOverviewSection(analysisResult),
      order: 1
    })

    // 技术架构
    sections.push({
      title: '技术架构',
      content: this.generateArchitectureSection(analysisResult),
      order: 2
    })

    // 代码质量分析
    sections.push({
      title: '代码质量分析',
      content: this.generateQualitySection(analysisResult),
      order: 3
    })

    // 依赖关系
    sections.push({
      title: '依赖关系',
      content: this.generateDependenciesSection(analysisResult),
      order: 4
    })

    // API文档
    if (analysisResult.llmInsights.technologyStack.includes('API')) {
      sections.push({
        title: 'API文档',
        content: this.generateApiSection(analysisResult),
        order: 5
      })
    }

    // 部署指南
    sections.push({
      title: '部署指南',
      content: this.generateDeploymentSection(analysisResult),
      order: 6
    })

    // 贡献指南
    sections.push({
      title: '贡献指南',
      content: this.generateContributingSection(analysisResult),
      order: 7
    })

    return {
      title: `${analysisResult.metadata.name} - 技术文档`,
      sections: sections.sort((a, b) => a.order - b.order),
      metadata: {
        generatedAt: new Date(),
        repository: analysisResult.metadata.name,
        version: '1.0.0'
      }
    }
  }

  // 渲染文档
  private renderDocument(template: DocumentTemplate, options: DocumentationOptions): string {
    if (options.format === 'markdown') {
      return this.renderMarkdown(template)
    } else {
      return this.renderHtml(template)
    }
  }

  // 渲染Markdown格式
  private renderMarkdown(template: DocumentTemplate): string {
    let content = `# ${template.title}

*生成时间：${template.metadata.generatedAt.toLocaleString('zh-CN')}*
*仓库：${template.metadata.repository}*

---

`

    template.sections.forEach(section => {
      content += `## ${section.title}\n\n${section.content}\n\n---\n\n`
    })

    return content
  }

  // 渲染HTML格式
  private renderHtml(template: DocumentTemplate): string {
    const sections = template.sections.map(section => 
      `<section id="${section.title.toLowerCase().replace(/\s+/g, '-')}">
        <h2>${section.title}</h2>
        <div class="content">${this.markdownToHtml(section.content)}</div>
      </section>`
    ).join('\n')

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 40px; }
        .metadata { color: #7f8c8d; font-style: italic; }
        .content { margin: 20px 0; }
        code { background: #f8f9fa; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${template.title}</h1>
        <div class="metadata">
            <p>生成时间：${template.metadata.generatedAt.toLocaleString('zh-CN')}</p>
            <p>仓库：${template.metadata.repository}</p>
        </div>
        ${sections}
    </div>
</body>
</html>`
  }

  // 生成概览部分
  private generateOverviewSection(analysisResult: AnalysisResult): string {
    return `## 项目基本信息

- **项目名称**：${analysisResult.metadata.name}
- **描述**：${analysisResult.metadata.description}
- **主要语言**：${analysisResult.metadata.language}
- **Star数**：${analysisResult.metadata.stars}
- **许可证**：${analysisResult.metadata.license || '未指定'}
- **主题标签**：${analysisResult.metadata.topics.join(', ')}

## 项目统计

- **总文件数**：${analysisResult.structure.totalFiles}
- **总目录数**：${analysisResult.structure.totalDirectories}
- **主要语言分布**：
${Object.entries(analysisResult.structure.languages)
  .map(([lang, count]) => `  - ${lang}: ${count}个文件`)
  .join('\n')}

## LLM分析洞察

${analysisResult.llmInsights.architecture}

### 关键技术特征
${analysisResult.llmInsights.keyPatterns.map(pattern => `- ${pattern}`).join('\n')}

### 技术栈
${analysisResult.llmInsights.technologyStack.map(tech => `- ${tech}`).join('\n')}`
  }

  // 生成架构部分
  private generateArchitectureSection(analysisResult: AnalysisResult): string {
    return `## 系统架构

${analysisResult.llmInsights.architecture}

## 代码质量评估

- **整体质量**：${analysisResult.llmInsights.codeQuality}
- **可维护性指数**：${analysisResult.codeQuality.maintainability}/100
- **代码重复率**：${analysisResult.codeQuality.duplication}%
- **平均复杂度**：${analysisResult.codeQuality.complexity.average}

## 架构建议

${analysisResult.llmInsights.recommendations.map(rec => `- ${rec}`).join('\n')}`
  }

  // 生成代码质量部分
  private generateQualitySection(analysisResult: AnalysisResult): string {
    const complexityDetails = analysisResult.codeQuality.complexity.files
      .slice(0, 10)
      .map(file => `- ${file.path}: 复杂度 ${file.complexity} (${file.lines}行)`)
      .join('\n')

    const securityIssues = analysisResult.codeQuality.securityIssues
      .map(issue => `- **${issue.severity.toUpperCase()}**: ${issue.type} - ${issue.description} (${issue.file}${issue.line ? `:${issue.line}` : ''})`)
      .join('\n')

    return `## 代码复杂度分析

### 高复杂度文件
${complexityDetails}

### 安全审计结果
${securityIssues || '未发现明显安全问题'}

### 质量建议

${analysisResult.llmInsights.potentialIssues.map(issue => `- ${issue}`).join('\n')}`
  }

  // 生成依赖关系部分
  private generateDependenciesSection(analysisResult: AnalysisResult): string {
    const prodDeps = analysisResult.dependencies.filter(dep => dep.type === 'production')
    const devDeps = analysisResult.dependencies.filter(dep => dep.type === 'development')

    return `## 生产依赖

${prodDeps.map(dep => `- **${dep.name}** ${dep.version}${dep.description ? ` - ${dep.description}` : ''}`).join('\n')}

## 开发依赖

${devDeps.map(dep => `- **${dep.name}** ${dep.version}${dep.description ? ` - ${dep.description}` : ''}`).join('\n')}

## 依赖管理建议

- 定期更新依赖版本
- 检查安全漏洞
- 移除未使用的依赖
- 考虑依赖包的大小影响`
  }

  // 生成API文档部分
  private generateApiSection(analysisResult: AnalysisResult): string {
    return `## API接口文档

基于代码分析，以下是项目的主要API接口：

### 核心接口

${analysisResult.llmInsights.technologyStack.includes('REST API') ? 
  '项目包含RESTful API接口，具体文档需要根据实际代码生成' : 
  '项目可能不包含传统REST API，建议查看具体实现'}

### 使用说明

1. **安装依赖**：根据项目类型执行相应的安装命令
2. **启动服务**：按照部署指南启动应用
3. **测试API**：使用示例代码进行接口测试

### 示例代码

\`\`\`javascript
// 示例API调用
const response = await fetch('/api/endpoint');
const data = await response.json();
\`\`\``
  }

  // 生成部署指南部分
  private generateDeploymentSection(analysisResult: AnalysisResult): string {
    return `## 部署指南

### 环境要求

- **运行环境**：根据项目技术栈确定
- **Node.js版本**：如适用
- **依赖管理器**：npm/yarn/pnpm

### 安装步骤

1. **克隆仓库**
   \`\`\`bash
   git clone [repository-url]
   cd ${analysisResult.metadata.name}
   \`\`\`

2. **安装依赖**
   \`\`\`bash
   npm install
   \`\`\`

3. **环境配置**
   - 复制 \`.env.example\` 到 \`.env\`
   - 根据需求配置环境变量

4. **启动应用**
   \`\`\`bash
   npm start
   \`\`\`

### 部署方式

- **本地开发**：npm run dev
- **生产部署**：npm run build && npm run start
- **容器部署**：Docker部署支持`}

  // 生成贡献指南部分
  private generateContributingSection(analysisResult: AnalysisResult): string {
    return `## 贡献指南

### 开发环境设置

1. **Fork仓库**
2. **创建功能分支**
   \`\`\`bash
   git checkout -b feature/your-feature
   \`\`\`

3. **提交规范**
   - 使用清晰的提交信息
   - 遵循项目的代码风格
   - 添加必要的测试

### 代码规范

- **代码风格**：遵循项目现有规范
- **测试要求**：新增功能需要测试覆盖
- **文档更新**：修改API时需要更新文档

### 提交流程

1. 创建功能分支
2. 进行开发
3. 运行测试
4. 提交Pull Request
5. 代码审查
6. 合并到主分支

### 问题报告

发现bug或有功能建议时，请通过以下方式提交：
- 创建GitHub Issue
- 提供详细的重现步骤
- 包含环境信息`}

  // 工具方法：Markdown转HTML
  private markdownToHtml(markdown: string): string {
    // 简单的markdown到html转换
    return markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\`([^`]+)\`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '<br>')
  }

  // 生成多个格式的文档
  async generateAllFormats(
    analysisResult: AnalysisResult,
    basePath: string
  ): Promise<Record<string, string>> {
    const generatedFiles: Record<string, string> = {}

    // 生成Markdown格式
    const mdPath = path.join(basePath, 'README.md')
    await this.generateDocumentation(analysisResult, mdPath, {
      format: 'markdown',
      includeCode: true,
      includeDiagrams: true
    })
    generatedFiles.markdown = mdPath

    // 生成HTML格式
    const htmlPath = path.join(basePath, 'documentation.html')
    await this.generateDocumentation(analysisResult, htmlPath, {
      format: 'html',
      includeCode: true,
      includeDiagrams: true
    })
    generatedFiles.html = htmlPath

    return generatedFiles
  }
}

// 专门的API文档生成器
export class ApiDocumentationGenerator {
  async generateApiDocs(
    analysisResult: AnalysisResult,
    outputPath: string
  ): Promise<string> {
    const apiContent = this.buildApiContent(analysisResult)
    await fs.writeFile(outputPath, apiContent, 'utf-8')
    return outputPath
  }

  private buildApiContent(analysisResult: AnalysisResult): string {
    return `# API文档 - ${analysisResult.metadata.name}

## 接口总览

基于代码分析生成的API文档。

## 认证

根据项目配置进行身份验证。

## 错误处理

所有API返回统一的错误格式：

\`\`\`json
{
  "error": "错误描述",
  "code": "错误代码"
}
\`\`\`

## 支持

如有问题，请查看项目README或提交Issue。
`
  }
}

// 文档生成器工厂
export class DocumentationGeneratorFactory {
  static create(type: 'full' | 'api' | 'readme' = 'full'): DocumentationGenerator | ApiDocumentationGenerator {
    switch (type) {
      case 'api':
        return new ApiDocumentationGenerator()
      case 'full':
      default:
        return new DocumentationGenerator()
    }
  }
}