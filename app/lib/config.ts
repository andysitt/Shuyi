// app/lib/config.ts
interface GitLabConfig {
  token: string;
  host: string;
}

interface GitHubConfig {
  token: string;
}

interface AppConfig {
  gitlab: GitLabConfig;
  github: GitHubConfig;
}

export function getGitLabConfig(): GitLabConfig {
  return {
    token: process.env.GITLAB_TOKEN || '',
    host: process.env.GITLAB_HOST || 'https://gitlab.com'
  };
}

export function getGitHubConfig(): GitHubConfig {
  return {
    token: process.env.GITHUB_TOKEN || ''
  };
}

export function getAppConfig(): AppConfig {
  return {
    gitlab: getGitLabConfig(),
    github: getGitHubConfig()
  };
}