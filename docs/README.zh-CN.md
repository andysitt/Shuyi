# CodeGrain: AI 驱动的 GitHub 仓库分析器

CodeGrain 是一款智能工具，旨在对 GitHub 仓库进行深度分析。它利用大语言模型（LLM）深入研究代码结构、质量、依赖关系，并生成全面的文档，为您提供可操作的见解。

## 核心功能

- **深度代码分析**: 自动分析仓库结构，识别关键依赖，并评估代码质量。
- **AI 驱动的洞察**: 利用 LLM（如 OpenAI 的 GPT 或 Anthropic 的 Claude）生成类似人类的分析、解释和文档。
- **自动化文档生成**: 为整个仓库创建详细的文档，包括概述和特定模块的解释，并以清晰、易读的格式呈现。

- **现代技术栈**: 使用 Next.js、Tailwind CSS 和 Prisma 构建，提供强大而现代的 Web 体验。
- **可扩展和可定制**: 分析过程的编排方式允许未来的扩展和定制。

## 工作原理

1.  **输入仓库 URL**: 用户提供一个公开的 GitHub 仓库 URL。
2.  **初步分析**: 应用程序克隆仓库并对其结构、依赖项和代码质量指标进行初步分析。
3.  **AI 编排**: `AnalysisOrchestrator` 管理核心分析流程。它使用一个 AI 代理（由 LangChain 驱动）来：
    a.  **创建计划**: AI 首先理解仓库，并创建一个需要编写哪些文档的计划。
    b.  **生成任务**: 根据计划，它将工作分解为一系列具体的文档编写任务。
    c.  **编写文档**: AI 执行每个任务，为代码库的不同部分编写详细的 markdown 文档。
4.  **存储和显示**: 生成的分析结果和 markdown 文档存储在 PostgreSQL 数据库中（由 Prisma 管理）。然后通过 Web 界面向用户展示结果和文档。

## 技术栈

- **框架**: [Next.js](https://nextjs.org/) (React)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)，使用 Radix UI 作为组件库。
- **数据库 ORM**: [Prisma](https://www.prisma.io/)
- **数据库**: [PostgreSQL](https://www.postgresql.org/)
- **AI/LLM**: [LangChain.js](https://js.langchain.com/)，用于与 [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/) 等模型进行交互。
- **Markdown 渲染**: [React Markdown](https://github.com/remarkjs/react-markdown) 用于安全、基于组件的内容显示。
- **代码高亮**: [highlight.js](https://highlightjs.org/)
- **图表**: [Mermaid](https://mermaid.js.org/)

## 本地部署指南

按照以下说明在您的本地计算机上获取并运行项目的副本，以进行开发和测试。

### 环境要求

- [Node.js](https://nodejs.org/en/) (建议使用 v18 或更高版本)
- [pnpm](https://pnpm.io/installation)
- [PostgreSQL](https://www.postgresql.org/download/)

### 安装与设置

1.  **克隆仓库:**
    ```bash
    git clone https://github.com/your-username/codegrain.git
    cd codegrain
    ```

2.  **安装依赖:**
    ```bash
    pnpm install
    ```

3.  **设置环境变量:**
    通过复制示例文件，在项目根目录下创建一个 `.env.local` 文件：
    ```bash
    cp .env.example .env.local
    ```
    现在，打开 `.env.local` 并填写下面环境变量部分所述的必需值。

4.  **设置数据库:**
    确保您的 PostgreSQL 服务器正在运行。应用程序将自动将模式与数据库同步。

5.  **运行开发服务器:**
    ```bash
    pnpm dev
    ```

    应用程序现在应该在 [http://localhost:3000](http://localhost:3000) 上运行。

## 环境变量

要运行该应用程序，您需要在 `.env.local` 文件中配置以下环境变量：

| 变量                  | 描述                                                                      | 示例                                           |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`        | 您的 PostgreSQL 数据库的连接字符串。                                      | `postgresql://user:password@host:port/database` |
| `LLM_API_KEY`         | 您选择的 LLM 提供商的 API 密钥（例如 OpenAI）。                           | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`           |
| `LLM_PROVIDER`        | 要使用的 LLM 提供商。支持：`openai`、`anthropic`、`custom`。              | `openai`                                       |
| `LLM_MODEL`           | 用于分析的具体模型。                                                      | `gpt-4-turbo`                                  |
| `LLM_BASE_URL`        | (可选) LLM API 的自定义端点，用于代理或其他提供商。                       | `https://api.deepseek.com`                     |
| `REDIS_URL`           | (可选) 您的 Redis 实例的连接字符串，用于缓存。                            | `redis://localhost:6379`                       |
| `GITHUB_TOKEN`        | 用于与 GitHub API 交互的 GitHub 个人访问令牌（用于更高的速率限制）。      | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`          |
| `NEXT_PUBLIC_API_URL` | 您的应用程序 API 的公共 URL。对于本地开发，这通常是 `http://localhost:3000`。 | `http://localhost:3000`                        |

## 许可证

该项目根据 MIT 许可证授权 - 有关详细信息，请参阅 LICENSE.md 文件。
