import { Octokit } from '@octokit/rest';
import { RepositoryMetadata } from '@/app/types';
import fs from 'fs-extra';
import path from 'path';
import { createWriteStream } from 'fs';

export class GitHubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  async validateRepository(url: string): Promise<{
    isValid: boolean;
    error?: string;
    owner?: string;
    repo?: string;
  }> {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return { isValid: false, error: '无效的GitHub仓库URL格式' };
      }

      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');

      try {
        const response = await this.octokit.repos.get({
          owner,
          repo: cleanRepo,
        });

        return {
          isValid: true,
          owner,
          repo: cleanRepo,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return { isValid: false, error: '仓库未找到或无法访问' };
        } else if (error.status === 403) {
          return { isValid: false, error: '访问被拒绝，可能仓库是私有的' };
        } else {
          return { isValid: false, error: '验证仓库时出错' };
        }
      }
    } catch (error) {
      return { isValid: false, error: '验证仓库URL时出错' };
    }
  }

  async getRepositoryMetadata(owner: string, repo: string): Promise<RepositoryMetadata> {
    try {
      const [repoResponse, languagesResponse] = await Promise.all([
        this.octokit.repos.get({ owner, repo }),
        this.octokit.repos.listLanguages({ owner, repo }),
      ]);
      const repoLastCommit = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: repoResponse.data.default_branch, // 可以是 branch, tag, 或 commit SHA
      });

      const repoData = repoResponse.data;
      const languages = languagesResponse.data;

      // 找出主要语言
      const primaryLanguage =
        Object.keys(languages).length > 0
          ? Object.keys(languages).reduce((a, b) => (languages[a] > languages[b] ? a : b))
          : 'Unknown';

      return {
        name: repoData.name,
        description: repoData.description || '',
        owner: repoData.owner.login,
        stars: repoData.stargazers_count,
        language: primaryLanguage,
        topics: repoData.topics || [],
        license: repoData.license?.name || undefined,
        size: repoData.size,
        createdAt: new Date(repoData.created_at),
        updatedAt: new Date(repoData.updated_at),
        lastCommit: {
          sha: repoLastCommit.data.sha,
          message: repoLastCommit.data.commit.message,
          date: new Date(repoLastCommit.data.commit.author?.date || Date.now()),
        },
      };
    } catch (error) {
      throw new Error(`获取仓库元数据失败: ${error}`);
    }
  }

  async getRepositoryTree(owner: string, repo: string, branch = 'main'): Promise<any> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: '',
        ref: branch,
      });

      return response.data;
    } catch (error) {
      // 尝试默认分支
      try {
        const { data: repoData } = await this.octokit.repos.get({
          owner,
          repo,
        });
        const defaultBranch = repoData.default_branch;

        const response = await this.octokit.repos.getContent({
          owner,
          repo,
          path: '',
          ref: defaultBranch,
        });

        return response.data;
      } catch (retryError) {
        throw new Error(`获取仓库文件树失败: ${retryError}`);
      }
    }
  }

  async getFileContent(owner: string, repo: string, path: string, branch = 'main'): Promise<string> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(response.data)) {
        throw new Error('请求的路径是目录，不是文件');
      }

      if (response.data.type === 'file') {
        return Buffer.from(response.data.content || '', 'base64').toString('utf-8');
      }

      throw new Error('无法获取文件内容');
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('文件未找到');
      }
      throw new Error(`获取文件内容失败: ${error}`);
    }
  }

  private async unzipFile(zipPath: string, extractPath: string): Promise<string> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);

      // 解压到临时目录
      const tempExtractPath = path.join(extractPath, '_temp_extract_');
      zip.extractAllTo(tempExtractPath, true);

      // 找到解压后的主目录
      const extractedDirs = await fs.readdir(tempExtractPath);
      if (extractedDirs.length === 0) {
        throw new Error('解压后没有找到目录');
      }

      const mainDir = path.join(tempExtractPath, extractedDirs[0]);

      // 移动内容到目标目录
      await fs.ensureDir(extractPath);
      await fs.copy(mainDir, extractPath);

      // 清理临时目录
      await fs.remove(tempExtractPath);

      return extractPath;
    } catch (error) {
      throw new Error(`解压文件失败: ${error}`);
    }
  }

  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });
      return data.default_branch;
    } catch (error) {
      return 'main'; // 默认分支
    }
  }

  async downloadRepository(owner: string, repo: string, branch = 'main'): Promise<string> {
    const validBranch = branch === 'main' ? await this.getDefaultBranch(owner, repo) : branch;
    const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${validBranch}.zip`;

    try {
      // 创建临时文件路径
      const tempDir = path.join('/tmp', `github-download-${Date.now()}`);
      await fs.ensureDir(tempDir);
      const zipPath = path.join(tempDir, `${repo}.zip`);

      // 下载ZIP文件
      console.log(`开始下载: ${downloadUrl}`);
      await this.downloadFile(downloadUrl, zipPath);

      return zipPath;
    } catch (error) {
      throw new Error(`下载仓库失败: ${error}`);
    }
  }

  async cloneRepository(repositoryUrl: string, targetPath: string): Promise<string> {
    const match = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('无效的GitHub仓库URL格式');
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '').replace(/\/$/, '');

    try {
      console.log(`开始克隆仓库: ${owner}/${cleanRepo} 到 ${targetPath}`);

      // 下载ZIP文件
      const zipPath = await this.downloadRepository(owner, cleanRepo);

      // 解压到目标目录
      const extractedPath = await this.unzipFile(zipPath, targetPath);

      // 清理ZIP文件
      await fs.remove(zipPath);

      console.log(`仓库克隆完成: ${extractedPath}`);
      return extractedPath;
    } catch (error) {
      // 清理失败的下载
      if (await fs.pathExists(targetPath)) {
        await fs.remove(targetPath);
      }
      throw new Error(`克隆仓库失败: ${error}`);
    }
  }

  private async downloadFile(url: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const writer = createWriteStream(outputPath);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        downloadedSize += value.length;
        if (totalSize > 0 && onProgress) {
          onProgress((downloadedSize / totalSize) * 100);
        }

        await new Promise<void>((resolve, reject) => {
          writer.write(value, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      writer.end();
    } catch (error) {
      throw new Error(`下载失败: ${error}`);
    }
  }
}
