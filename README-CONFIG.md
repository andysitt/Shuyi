# LLM 配置指南

## 新的环境变量配置

项目现在支持灵活的LLM配置，通过以下环境变量：

### 基本配置
```bash
# 必需
LLM_API_KEY=your-api-key-here
LLM_PROVIDER=openai  # openai, anthropic, 或 custom
LLM_MODEL=gpt-4      # 模型名称

# 可选
LLM_BASE_URL=https://api.openai.com/v1  # 自定义API端点
```

### 支持的提供商

#### 1. OpenAI
```bash
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
```

#### 2. Anthropic
```bash
LLM_API_KEY=your-anthropic-key
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-sonnet-20240229
```

#### 3. 自定义OpenAI兼容API
支持任何兼容OpenAI格式的API，如：
- DeepSeek
- 通义千问
- 智谱清言
- 私有化部署

##### DeepSeek示例
```bash
LLM_API_KEY=your-deepseek-key
LLM_PROVIDER=custom
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
```

##### 通义千问示例
```bash
LLM_API_KEY=your-qwen-key
LLM_PROVIDER=custom
LLM_MODEL=qwen-max
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

##### 本地部署示例
```bash
LLM_API_KEY=your-local-key
LLM_PROVIDER=custom
LLM_MODEL=your-model-name
LLM_BASE_URL=http://localhost:8000/v1
```

### 配置验证

运行以下命令验证配置：
```bash
# 检查环境变量
node -e "console.log(process.env.LLM_PROVIDER, process.env.LLM_MODEL, process.env.LLM_BASE_URL || 'default')"

# 测试API连接
npm run test-llm
```

### 配置文件

复制 `.env.example` 为 `.env.local` 并修改：

```bash
cp .env.example .env.local
```

然后编辑 `.env.local` 文件，设置你的LLM配置。

### 支持的模型

#### OpenAI模型
- gpt-4
- gpt-4-turbo
- gpt-3.5-turbo

#### Anthropic模型
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

#### 其他兼容模型
- 任何支持OpenAI格式的模型都可以使用
- 只需设置正确的provider为"custom"