#!/usr/bin/env node

/**
 * LLM集成测试
 * 验证完整的LLM代码分析流程
 */

import { AnalysisOrchestrator } from './app/lib/analysis-orchestrator'
import { GitHubClient } from './app/lib/github-client'
import { LLMClient } from './app/lib/llm-client'
import path from 'path'
import fs from 'fs-extra'

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

class LLMIntegrationTester {
  private testRepoPath: string

  constructor() {
    this.testRepoPath = path.join(process.cwd(), 'test-sample')
  }

  async runTests() {
    log('🤖 开始LLM集成测试...', 'info')
    
    // 检查API密钥
    const apiKey = process.env.LLM_API_KEY
    if (!apiKey) {
      log('❌ 未找到LLM API密钥，请先设置 LLM_API_KEY', 'error')
      return
    }

    await this.testLLMClient()
    await this.testAnalysisOrchestrator()
    await this.testFileAnalysis()
    await this.testProjectAnalysis()
    
    log('\n🎉 LLM集成测试完成！', 'success')
  }

  async testLLMClient() {
    log('\n🔍 测试LLM客户端...', 'info')
    
    const llmClient = new LLMClient({
      provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic' || 'openai',
      apiKey: process.env.LLM_API_KEY || '',
      model: process.env.LLM_MODEL || 'gpt-4',
      baseURL: process.env.LLM_BASE_URL,
      maxTokens: 1000,
      temperature: 0.3
    })

    try {
      const testCode = `
function calculateSum(numbers) {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}
      `

      const result = await llmClient.analyzeCode({
        code: testCode,
        filePath: 'test.js',
        language: 'JavaScript',
        analysisType: 'overview'
      })

      log(`✅ LLM客户端测试通过: ${result.summary.slice(0, 100)}...`, 'success')
    } catch (error) {
      log(`❌ LLM客户端测试失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  async testAnalysisOrchestrator() {
    log('\n🎯 测试分析协调器...', 'info')
    
    // 创建测试项目
    await this.createTestProject()
    
    const orchestrator = new AnalysisOrchestrator({
      llmConfig: {
        provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic' || 'openai',
        apiKey: process.env.LLM_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-4',
        baseURL: process.env.LLM_BASE_URL
      },
      analysisType: 'full',
      maxFilesToAnalyze: 5
    }, this.testRepoPath)

    try {
      const mockMetadata = {
        name: 'test-project',
        description: '测试项目用于LLM分析',
        owner: 'test',
        stars: 100,
        language: 'TypeScript',
        topics: ['react', 'typescript', 'testing'],
        license: 'MIT',
        size: 1024,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await orchestrator.analyzeRepository(
        this.testRepoPath,
        mockMetadata,
        (progress) => {
          log(`📊 进度: ${progress.stage} - ${progress.progress}%`, 'info')
        }
      )

      log(`✅ 分析协调器测试通过:`, 'success')
      log(`   项目: ${result.metadata.name}`, 'info')
      log(`   语言: ${result.metadata.language}`, 'info')
      log(`   复杂度: ${result.codeQuality.complexity.average}`, 'info')
      log(`   洞察: ${result.llmInsights.architecture.slice(0, 100)}...`, 'info')

    } catch (error) {
      log(`❌ 分析协调器测试失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  async testFileAnalysis() {
    log('\n📄 测试文件分析...', 'info')
    
    const testFile = path.join(this.testRepoPath, 'src', 'app.ts')
    
    const orchestrator = new AnalysisOrchestrator({
      llmConfig: {
        provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic' || 'openai',
        apiKey: process.env.LLM_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-4',
        baseURL: process.env.LLM_BASE_URL
      },
      analysisType: 'quality'
    }, this.testRepoPath)

    try {
      const fileAnalysis = await orchestrator.analyzeFile(testFile, 'complexity')
      
      log(`✅ 文件分析测试通过:`, 'success')
      log(`   文件: ${testFile}`, 'info')
      log(`   总结: ${fileAnalysis.summary.slice(0, 100)}...`, 'info')
      log(`   质量分数: ${fileAnalysis.codeQuality.score}`, 'info')
      
    } catch (error) {
      log(`❌ 文件分析测试失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  async testProjectAnalysis() {
    log('\n🏗️ 测试项目分析...', 'info')
    
    const llmClient = new LLMClient({
      provider: process.env.LLM_PROVIDER as 'openai' | 'anthropic' || 'openai',
      apiKey: process.env.LLM_API_KEY || '',
      model: process.env.LLM_MODEL || 'gpt-4',
      baseURL: process.env.LLM_BASE_URL,
      maxTokens: 1500
    })

    try {
      const projectPrompt = {
        projectStructure: JSON.stringify({
          src: ['app.ts', 'utils.ts', 'config.ts'],
          tests: ['app.test.ts'],
          package: 'package.json'
        }, null, 2),
        keyFiles: [{
          path: 'src/app.ts',
          content: `
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' })
})

export default app
          `.trim(),
          language: 'TypeScript'
        }],
        dependencies: ['express', 'cors', 'typescript'],
        entryPoints: ['src/app.ts'],
        analysisGoal: '理解项目架构'
      }

      const projectAnalysis = await llmClient.analyzeProject(projectPrompt)
      
      log(`✅ 项目分析测试通过:`, 'success')
      log(`   架构: ${projectAnalysis.architecture.slice(0, 100)}...`, 'info')
      log(`   技术栈: ${projectAnalysis.technologyStack.join(', ')}`, 'info')
      log(`   关键功能: ${projectAnalysis.keyFeatures.slice(0, 2).join(', ')}`, 'info')
      
    } catch (error) {
      log(`❌ 项目分析测试失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  async createTestProject() {
    await fs.ensureDir(this.testRepoPath)
    await fs.ensureDir(path.join(this.testRepoPath, 'src'))
    
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      description: '测试项目用于LLM分析',
      main: 'src/app.ts',
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5'
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/express': '^4.17.0'
      },
      scripts: {
        start: 'node dist/app.js',
        dev: 'ts-node src/app.ts'
      }
    }

    await fs.writeJson(path.join(this.testRepoPath, 'package.json'), packageJson, { spaces: 2 })
    
    const appTs = `
import express from 'express'
import cors from 'cors'

interface User {
  id: number
  name: string
  email: string
}

class AppServer {
  private app: express.Application
  private port: number

  constructor(port: number) {
    this.app = express()
    this.port = port
    this.initializeMiddleware()
    this.initializeRoutes()
  }

  private initializeMiddleware() {
    this.app.use(cors())
    this.app.use(express.json())
  }

  private initializeRoutes() {
    this.app.get('/', (req, res) => {
      res.json({ message: 'Hello World' })
    })

    this.app.get('/users', (req, res) => {
      const users: User[] = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ]
      res.json(users)
    })
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(\`Server running on port \${this.port}\`)
    })
  }
}

const server = new AppServer(3000)
server.start()
    `.trim()

    await fs.writeFile(path.join(this.testRepoPath, 'src', 'app.ts'), appTs)
    await fs.writeFile(path.join(this.testRepoPath, 'README.md'), '# Test Project\n\nThis is a test project for LLM analysis.')
  }

  async cleanup() {
    await fs.remove(this.testRepoPath)
  }
}

// 运行测试
async function runLLMTests() {
  try {
    const tester = new LLMIntegrationTester()
    await tester.runTests()
    await tester.cleanup()
  } catch (error) {
    log(`测试运行失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    process.exit(1)
  }
}

// 如果直接运行
if (require.main === module) {
  runLLMTests().catch(console.error)
}

export { LLMIntegrationTester }