// 新的LLM配置测试脚本
const { spawn } = require('child_process')

console.log('🤖 LLM配置测试')
console.log('=================')

// 检查环境变量
const apiKey = process.env.LLM_API_KEY
const provider = process.env.LLM_PROVIDER || 'openai'
const model = process.env.LLM_MODEL || 'gpt-4'
const baseURL = process.env.LLM_BASE_URL

console.log('📋 当前配置:')
console.log('  LLM_API_KEY:', apiKey ? '✅ 已设置' : '❌ 未设置')
console.log('  LLM_PROVIDER:', provider)
console.log('  LLM_MODEL:', model)
console.log('  LLM_BASE_URL:', baseURL || '使用默认')

if (!apiKey) {
  console.log('\n❌ 错误: LLM_API_KEY 环境变量未设置')
  console.log('   请在 .env.local 文件中设置：')
  console.log('   LLM_API_KEY=your-api-key')
  console.log('   LLM_PROVIDER=openai')
  console.log('   LLM_MODEL=gpt-4')
  process.exit(1)
}

console.log('\n✅ 配置验证通过！')
console.log('\n🎯 支持的提供商:')
console.log('  - openai: OpenAI官方API')
console.log('  - anthropic: Anthropic官方API')
console.log('  - custom: 任何OpenAI兼容API')

console.log('\n💡 使用示例:')
console.log('  # DeepSeek')
console.log('  LLM_API_KEY=your-key LLM_PROVIDER=custom LLM_MODEL=deepseek-chat LLM_BASE_URL=https://api.deepseek.com/v1')
console.log('  ')
console.log('  # 通义千问')
console.log('  LLM_API_KEY=your-key LLM_PROVIDER=custom LLM_MODEL=qwen-max LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1')
console.log('  ')
console.log('  # 本地部署')
console.log('  LLM_API_KEY=your-key LLM_PROVIDER=custom LLM_MODEL=your-model LLM_BASE_URL=http://localhost:8000/v1')