#!/usr/bin/env node

/**
 * LLM工具框架集成测试
 * 用于验证所有组件的正确性和集成性
 */

import path from 'path'
import { ToolManager } from './app/lib/llm-tools/tool-manager'
import { SessionManager } from './app/lib/llm-tools/session-manager'
import { PromptBuilder } from './app/lib/llm-tools/prompt-builder'
import { DocumentationGenerator } from './app/lib/documentation-generator'
import { cacheManager } from './app/lib/cache-manager'
import { AnalysisResult, DependencyInfo } from './app/types'

// 测试配置
const TEST_REPO_PATH = path.join(process.cwd())

// 颜色输出工具
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const colorMap = {
    success: colors.green,
    error: colors.red,
    info: colors.blue,
    warning: colors.yellow
  }
  console.log(`${colorMap[type]}${message}${colors.reset}`)
}

// 测试结果类型
interface TestResult {
  name: string
  success: boolean
  error?: string
  duration: number
  data?: any
}

class LLMFrameworkTester {
  private toolManager: ToolManager
  private sessionManager: SessionManager
  private results: TestResult[] = []

  constructor() {
    this.toolManager = new ToolManager(TEST_REPO_PATH)
    this.sessionManager = new SessionManager(TEST_REPO_PATH)
  }

  async runAllTests(): Promise<void> {
    log('🚀 开始LLM工具框架集成测试...', 'info')
    
    await this.testToolManager()
    await this.testSessionManager()
    await this.testPromptBuilder()
    await this.testDocumentationGenerator()
    await this.testCacheManager()
    
    this.printSummary()
  }

  private async testToolManager(): Promise<void> {
    log('\n📋 测试工具管理器...', 'info')
    
    // 测试可用工具
    const tools = this.toolManager.getAvailableTools()
    this.recordResult('工具列表获取', {
      success: tools.length > 0,
      data: { toolCount: tools.length, tools: tools.map(t => t.name) },
      duration: 0
    })
    
    // 测试工具执行
    try {
      const start = Date.now()
      const result = await this.toolManager.executeTool('filesystem', {
        action: 'list',
        path: '.'
      })
      const duration = Date.now() - start
      
      this.recordResult('文件系统工具执行', {
        success: result.success,
        duration,
        error: result.error,
        data: result.data?.files?.length || 0
      })
    } catch (error) {
      this.recordResult('文件系统工具执行', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })
    }
  }

  private async testSessionManager(): Promise<void> {
    log('\n🎯 测试会话管理器...', 'info')
    
    const sessionId = `test_${Date.now()}`
    
    try {
      // 创建会话
      const start = Date.now()
      const session = await this.sessionManager.createSession(
        '测试会话',
        TEST_REPO_PATH
      )
      const duration = Date.now() - start
      
      this.recordResult('会话创建', {
        success: !!session,
        duration,
        data: { sessionId: session.sessionId }
      })
      
      // 测试会话获取
      const retrievedSession = this.sessionManager.getSession(session.sessionId)
      this.recordResult('会话获取', {
        success: !!retrievedSession,
        data: { sessionId: retrievedSession?.sessionId },
        duration: 0
      })
      
      // 测试会话摘要
      const summary = this.sessionManager.getSessionSummary(session.sessionId)
      this.recordResult('会话摘要', {
        success: !!summary,
        data: { analysisGoal: summary?.analysisGoal },
        duration: 0
      })
      
      // 清理
      this.sessionManager.endSession(session.sessionId)
      
    } catch (error) {
      this.recordResult('会话管理', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })
    }
  }

  private async testPromptBuilder(): Promise<void> {
    log('\n📝 测试提示词构建器...', 'info')
    
    try {
      const start = Date.now()
      const prompt = PromptBuilder.buildAnalysisPrompt(
        'full_analysis',
        {
          name: 'test-repo',
          description: '测试仓库',
          language: 'TypeScript',
          stars: 100
        }
      )
      const duration = Date.now() - start
      
      this.recordResult('提示词构建', {
        success: prompt.length > 0,
        duration,
        data: { promptLength: prompt.length }
      })
      
    } catch (error) {
      this.recordResult('提示词构建', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })
    }
  }

  private async testDocumentationGenerator(): Promise<void> {
    log('\n📄 测试文档生成器...', 'info')
    
    try {
      const generator = new DocumentationGenerator()
      const mockAnalysisResult: AnalysisResult = {
        metadata: {
          name: 'test-project',
          description: '测试项目描述',
          language: 'TypeScript',
          stars: 100,
          topics: ['react', 'typescript', 'nextjs'],
          license: 'MIT',
          size: 1024,
          owner: 'test-owner',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        structure: {
          root: { name: 'root', type: 'directory' as const, path: '.', size: 1024 },
          totalFiles: 50,
          totalDirectories: 10,
          languages: { TypeScript: 30, JavaScript: 15, CSS: 5 },
          keyFiles: []
        },
        dependencies: [
          { name: 'react', version: '18.0.0', type: 'production' as const },
          { name: 'typescript', version: '5.0.0', type: 'development' as const }
        ] as DependencyInfo[],
        codeQuality: {
          complexity: { average: 5, max: 15, files: [] },
          duplication: 10,
          maintainability: 85,
          securityIssues: [],
          testCoverage: 80
        },
        llmInsights: {
          architecture: '现代React应用架构',
          keyPatterns: ['组件化设计', 'TypeScript使用', '现代开发实践'],
          potentialIssues: ['需要更多测试', '部分代码复杂度过高'],
          recommendations: ['增加单元测试', '优化复杂函数'],
          technologyStack: ['React', 'TypeScript', 'Next.js'],
          codeQuality: '良好'
        }
      }
      
      const start = Date.now()
      const tempPath = path.join(process.cwd(), 'test-docs', 'README.md')
      const outputPath = await generator.generateDocumentation(
        mockAnalysisResult,
        tempPath
      )
      const duration = Date.now() - start
      
      this.recordResult('文档生成', {
        success: !!outputPath,
        duration,
        data: { outputPath }
      })
      
    } catch (error) {
      this.recordResult('文档生成', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })
    }
  }

  private async testCacheManager(): Promise<void> {
    log('\n💾 测试缓存管理器...', 'info')
    
    try {
      const start = Date.now()
      const testKey = 'test-cache-key'
      const testData = { message: '测试数据', timestamp: Date.now() }
      
      // 设置缓存
      await cacheManager.set(testKey, testData, 60)
      
      // 获取缓存
      const retrievedData = await cacheManager.get(testKey)
      const duration = Date.now() - start
      
      this.recordResult('缓存管理', {
        success: JSON.stringify(retrievedData) === JSON.stringify(testData),
        duration,
        data: { cacheType: cacheManager.constructor.name }
      })
      
      // 清理
      await cacheManager.delete(testKey)
      
    } catch (error) {
      this.recordResult('缓存管理', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })
    }
  }

  private recordResult(name: string, result: Omit<TestResult, 'name'>): void {
    this.results.push({ name, ...result, duration: result.duration || 0 })
  }

  private printSummary(): void {
    const totalTests = this.results.length
    const passedTests = this.results.filter(r => r.success).length
    const failedTests = totalTests - passedTests
    
    log('\n' + '='.repeat(50), 'info')
    log('📊 测试完成汇总', 'info')
    log('='.repeat(50), 'info')
    
    this.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL'
      const duration = result.duration ? `(${result.duration}ms)` : ''
      log(`${status} ${result.name} ${duration}`, result.success ? 'success' : 'error')
      
      if (!result.success && result.error) {
        log(`   错误: ${result.error}`, 'error')
      }
    })
    
    log('\n' + '='.repeat(50), 'info')
    log(`总计: ${totalTests} 个测试`, 'info')
    log(`通过: ${passedTests} 个`, 'success')
    log(`失败: ${failedTests} 个`, failedTests > 0 ? 'error' : 'success')
    log('='.repeat(50), 'info')
    
    if (failedTests === 0) {
      log('🎉 所有测试通过！框架运行正常', 'success')
    } else {
      log('⚠️  部分测试失败，请检查错误信息', 'warning')
    }
  }
}

// 运行测试的入口函数
async function runTests() {
  try {
    const tester = new LLMFrameworkTester()
    await tester.runAllTests()
  } catch (error) {
    log(`测试运行失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runTests().catch(console.error)
}

export { LLMFrameworkTester }