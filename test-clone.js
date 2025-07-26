#!/usr/bin/env node

/**
 * GitHub克隆功能测试
 */

import { GitHubClient } from './app/lib/github-client.js'
import path from 'path'
import fs from 'fs-extra'

async function testClone() {
  console.log('🧪 测试GitHub克隆功能...')
  
  const githubClient = new GitHubClient(process.env.GITHUB_TOKEN)
  
  // 测试URL
  const testRepo = 'https://github.com/microsoft/vscode'
  
  try {
    console.log('📋 验证仓库...')
    const validation = await githubClient.validateRepository(testRepo)
    console.log('✅ 验证结果:', validation)
    
    if (!validation.isValid) {
      console.error('❌ 仓库验证失败:', validation.error)
      return
    }
    
    const tempDir = path.join(process.cwd(), 'test-clone')
    await fs.ensureDir(tempDir)
    
    console.log('📦 开始克隆...')
    const clonedPath = await githubClient.cloneRepository(
      testRepo, 
      path.join(tempDir, 'vscode')
    )
    
    console.log('✅ 克隆完成:', clonedPath)
    
    // 验证文件
    const files = await fs.readdir(clonedPath)
    console.log('📁 克隆的文件:', files.slice(0, 10))
    
    // 清理
    await fs.remove(tempDir)
    console.log('🧹 测试清理完成')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  testClone().catch(console.error)
}