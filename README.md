[简体中文](./docs/README.zh-CN.md)

# Shuyi: AI-Powered GitHub Repository Analyzer

Shuyi is an intelligent tool designed to perform deep analysis of GitHub repositories. By leveraging Large Language Models (LLMs), it delves into code structure, quality, dependencies, and generates comprehensive documentation to provide you with actionable insights.

## Key Features

- **In-depth Code Analysis**: Automatically analyzes repository structure, identifies key dependencies, and assesses code quality.
- **AI-Powered Insights**: Utilizes LLMs (like OpenAI's GPT or Anthropic's Claude) to generate human-like analysis, explanations, and documentation.
- **Automated Documentation Generation**: Creates detailed documentation for the entire repository, including overviews and specific module explanations, presented in a clean, readable format.

- **Modern Tech Stack**: Built with Next.js, Tailwind CSS, and Prisma for a robust and modern web experience.
- **Extensible and Customizable**: The analysis process is orchestrated in a way that allows for future expansion and customization.

## How It Works

1.  **Input Repository URL**: The user provides a public GitHub repository URL.
2.  **Initial Analysis**: The application clones the repository and performs an initial analysis of its structure, dependencies, and code quality metrics.
3.  **AI Orchestration**: An `AnalysisOrchestrator` manages the core analysis flow. It uses an AI Agent (powered by LangChain) to:
    a.  **Create a Plan**: The AI first understands the repository and creates a plan for what documentation needs to be written.
    b.  **Generate Tasks**: Based on the plan, it breaks down the work into a list of specific documentation tasks.
    c.  **Write Documents**: The AI executes each task, writing detailed markdown documents for different parts of the codebase.
4.  **Store and Display**: The generated analysis results and markdown documents are stored in a PostgreSQL database (managed by Prisma). The results and documentation are then presented to the user through the web interface.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with Radix UI for components.
- **Database ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **AI/LLM**: [LangChain.js](https://js.langchain.com/) to interact with models from [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), etc.
- **Markdown Rendering**: [React Markdown](https://github.com/remarkjs/react-markdown) for secure and component-based content display.
- **Code Highlighting**: [highlight.js](https://highlightjs.org/)
- **Diagrams**: [Mermaid](https://mermaid.js.org/)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later recommended)
- [pnpm](https://pnpm.io/installation)
- [PostgreSQL](https://www.postgresql.org/download/)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/Shuyi.git
    cd Shuyi
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Now, open `.env` and fill in the required values as described in the Environment Variables section below.

4.  **Set up the database:**

    a. **Start PostgreSQL**: Make sure your PostgreSQL server is running.

    b. **Create a Database**: You need to create a database for Shuyi to use. You can do this with a tool like `psql` or any database GUI. For example:
       ```sql
       CREATE DATABASE shuyi;
       ```

    c. **Configure `.env`**: Update the `DATABASE_URL` in your `.env` file to point to the database you just created. For example:
       ```
       DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/shuyi"
       ```

    d. **Sync the Schema**: Run the following command to apply the schema to your new database. This will create all the necessary tables.
       ```bash
       pnpm run prisma:db:push
       ```

5.  **Run the development server:**
    ```bash
    pnpm dev
    ```

    The application should now be running at [http://localhost:3000](http://localhost:3000).

## Environment Variables

To run the application, you need to configure the following environment variables in your `.env` file:

| Variable              | Description                                                                                             | Example                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`        | The connection string for your PostgreSQL database.                                                     | `postgresql://user:password@host:port/database` |
| `LLM_API_KEY`         | Your API key for the chosen LLM provider (e.g., OpenAI).                                                | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`           |
| `LLM_PROVIDER`        | The LLM provider to use. Supported: `openai`, `anthropic`, `custom`.                                    | `openai`                                       |
| `LLM_MODEL`           | The specific model to use for analysis.                                                                 | `gpt-4-turbo`                                  |
| `LLM_BASE_URL`        | (Optional) A custom endpoint for the LLM API, for proxies or other providers.                           | `https://api.deepseek.com`                     |
| `REDIS_URL`           | (Optional) The connection string for your Redis instance, used for caching.                             | `redis://localhost:6379`                       |
| `GITHUB_TOKEN`        | A GitHub Personal Access Token to interact with the GitHub API (for higher rate limits).                | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`          |
| `NEXT_PUBLIC_API_URL` | The public URL of your application's API. For local development, this is usually `http://localhost:3000`. | `http://localhost:3000`                        |

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
