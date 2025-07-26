# GitHub克隆功能使用指南

## 功能概述

GitHub客户端现在支持完整的仓库克隆功能，包括：
- ZIP文件下载
- 自动解压
- 错误处理
- 进度跟踪
- 分支检测

## 使用方法

### 基本使用

```typescript
import { GitHubClient } from './app/lib/github-client'

const githubClient = new GitHubClient(process.env.GITHUB_TOKEN)

// 克隆仓库
const repositoryPath = await githubClient.cloneRepository(
  'https://github.com/owner/repository',
  '/path/to/target/directory'
)

console.log('仓库已克隆到:', repositoryPath)
```

### 高级用法

```typescript
// 指定分支
const repositoryPath = await githubClient.cloneRepository(
  'https://github.com/owner/repository',
  '/path/to/target/directory',
  'dev' // 指定分支
)
```

## 支持的URL格式

- ✅ `https://github.com/owner/repo`
- ✅ `https://github.com/owner/repo.git`
- ✅ `https://github.com/owner/repo/`
- ❌ 非GitHub URL会返回错误

## 错误处理

### 常见错误

1. **无效URL格式**
   ```
   错误: 无效的GitHub仓库URL格式
   ```

2. **仓库不存在**
   ```
   错误: 仓库未找到或无法访问
   ```

3. **私有仓库无权限**
   ```
   错误: 访问被拒绝，可能仓库是私有的
   ```

4. **网络错误**
   ```
   错误: 下载失败: HTTP错误: 404 Not Found
   ```

### 错误处理示例

```typescript
try {
  const path = await githubClient.cloneRepository(url, targetPath)
  console.log('成功:', path)
} catch (error) {
  console.error('克隆失败:', error.message)
  // 清理失败目录
  await fs.remove(targetPath)
}
```

## 环境要求

### 依赖包

```bash
npm install adm-zip @types/adm-zip
```

### 环境变量

```bash
export GITHUB_TOKEN=your_github_token  # 可选，用于私有仓库
```

## 测试

运行测试脚本：

```bash
node test-clone.js
```

## 技术实现

### 核心功能

1. **ZIP下载**: 使用GitHub的archive API
2. **自动解压**: 使用adm-zip库
3. **分支检测**: 自动获取默认分支
4. **错误恢复**: 清理失败下载
5. **进度跟踪**: 支持下载进度回调

### 文件结构

```
repository/
├── .git/          # Git信息
├── src/           # 源代码
├── package.json   # 项目配置
├── README.md      # 项目文档
└── ...            # 其他文件
```

## 性能优化

- 支持大文件下载
- 内存优化处理
- 自动清理临时文件
- 错误重试机制