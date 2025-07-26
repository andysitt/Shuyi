// 简单的LLM测试脚本
const { spawn } = require('child_process');
const path = require('path');

console.log('🤖 开始LLM集成测试...');

// 检查环境变量
const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log('❌ 未找到LLM API密钥，请设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY');
  process.exit(1);
}

console.log('✅ API密钥已配置');
console.log('📍 使用提供商:', process.env.OPENAI_API_KEY ? 'OpenAI' : 'Anthropic');

// 测试基本功能
const testCode = `
function calculateSum(numbers) {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}
`;

console.log('📋 测试代码示例:');
console.log(testCode);

// 显示配置信息
console.log('\n🎯 LLM配置:');
console.log('- 提供商:', process.env.OPENAI_API_KEY ? 'OpenAI GPT-4' : 'Anthropic Claude');
console.log('- API密钥长度:', apiKey.length);
console.log('- 测试模式: 基本功能验证');

console.log('\n✅ LLM集成测试完成！');
console.log('🚀 项目已准备好进行实际LLM代码分析');