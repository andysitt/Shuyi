import { Gitlab } from '@gitbeaker/rest';
import { RepositoryMetadata } from '@/app/types';
import fs from 'fs-extra';
import path from 'path';

export class GitLabClient {
  private gitlab: InstanceType<typeof Gitlab>;

  constructor(token?: string, host?: string) {
    this.gitlab = new Gitlab({
      token: token || process.env.GITLAB_TOKEN,
      host: host || process.env.GITLAB_HOST || 'https://gitlab.com',
    });
  }

  async validateRepository(url: string): Promise<{
    isValid: boolean;
    error?: string;
    projectId?: number;
    projectPath?: string;
  }> {
    try {
      // 解析GitLab URL
      const projectPath = this.extractProjectPath(url);
      if (!projectPath) {
        return { isValid: false, error: '无效的GitLab项目URL格式' };
      }

      try {
        // 尝试获取项目信息
        const project = await this.gitlab.Projects.show(projectPath);

        return {
          isValid: true,
          projectId: project.id as number,
          projectPath: project.path_with_namespace as string,
        };
      } catch (error: any) {
        if (error.status === 404) {
          return { isValid: false, error: '项目未找到或无法访问' };
        } else if (error.status === 403) {
          return { isValid: false, error: '访问被拒绝，可能项目是私有的' };
        } else {
          return { isValid: false, error: '验证项目时出错' };
        }
      }
    } catch (error) {
      return { isValid: false, error: '验证项目URL时出错' };
    }
  }

  async getRepositoryMetadata(identifier: number | string): Promise<RepositoryMetadata> {
    try {
      const project = await this.gitlab.Projects.show(identifier);

      // 获取主要语言
      let primaryLanguage = 'Unknown';
      try {
        // 使用正确的API方法获取项目语言
        const languages: Record<string, number> = await (this.gitlab as any).Projects.languages(identifier);
        if (Object.keys(languages).length > 0) {
          primaryLanguage = Object.keys(languages).reduce((a, b) => (languages[a] > languages[b] ? a : b));
        }
      } catch (langError) {
        // 如果无法获取语言信息，保持默认值
      }

      // 获取最后提交
      let lastCommit = {
        sha: '',
        message: '',
        date: new Date(),
      };

      try {
        const commits = await this.gitlab.Commits.all(identifier, {
          perPage: 1,
          refName: project.default_branch as string,
        });

        if (commits.length > 0) {
          const commit = commits[0];
          lastCommit = {
            sha: commit.id,
            message: commit.message,
            date: new Date(commit.committed_date as string),
          };
        }
      } catch (commitError) {
        // 如果无法获取提交信息，使用默认值
      }

      return {
        name: project.name,
        description: project.description || '',
        owner: project.namespace.full_path as string,
        stars: project.star_count as number,
        language: primaryLanguage,
        topics: (project.tag_list as string[]) || [],
        license: project.license?.name || undefined,
        size: (project.repository_size as number) || 0,
        createdAt: new Date(project.created_at as string),
        updatedAt: new Date(project.last_activity_at as string),
        lastCommit,
        // GitLab特有字段
        projectId: project.id as number,
        namespace: project.namespace.full_path as string,
        visibility: project.visibility as string,
      };
    } catch (error) {
      throw new Error(`获取项目元数据失败: ${error}`);
    }
  }

  async getRepositoryTree(identifier: number | string, branch = 'main'): Promise<any> {
    try {
      // 尝试使用指定分支
      const tree = await this.gitlab.Repositories.allRepositoryTrees(identifier, {
        ref: branch,
        recursive: false,
      });

      return tree;
    } catch (error) {
      // 尝试使用默认分支
      try {
        const project = await this.gitlab.Projects.show(identifier);
        const tree = await this.gitlab.Repositories.allRepositoryTrees(identifier, {
          ref: project.default_branch as string,
          recursive: false,
        });

        return tree;
      } catch (retryError) {
        throw new Error(`获取项目文件树失败: ${retryError}`);
      }
    }
  }

  async getFileContent(identifier: number | string, path: string, branch = 'main'): Promise<string> {
    try {
      const file = await this.gitlab.RepositoryFiles.show(identifier, path, branch);

      if (file.content) {
        return Buffer.from(file.content, 'base64').toString('utf-8');
      }

      throw new Error('无法获取文件内容');
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('文件未找到');
      }
      throw new Error(`获取文件内容失败: ${error}`);
    }
  }

  async downloadRepository(identifier: number | string, branch = 'main'): Promise<string> {
    try {
      // 创建临时文件路径
      const tempDir = path.join('/tmp', `gitlab-download-${Date.now()}`);
      await fs.ensureDir(tempDir);
      const zipPath = path.join(tempDir, `project-${identifier}.zip`);

      // 获取项目信息以确定默认分支
      const project = await this.gitlab.Projects.show(identifier);
      const targetBranch = branch === 'main' ? (project.default_branch as string) || 'main' : branch;
      this.gitlab.Repositories;
      // 下载项目归档 - 使用正确的API方法
      const archiveBuffer = await this.gitlab.Repositories.showArchive(identifier, {
        fileType: 'zip',
        sha: targetBranch,
      });
      const arrayBuffer = await archiveBuffer.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // 将归档内容写入文件
      await fs.writeFile(zipPath, buffer);

      return zipPath;
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error('项目或分支未找到');
      } else if (error.status === 403) {
        throw new Error('访问被拒绝，可能项目是私有的');
      }
      throw new Error(`下载项目失败: ${error.message}`);
    }
  }

  async cloneRepository(repositoryUrl: string, targetPath: string): Promise<string> {
    const validation = await this.validateRepository(repositoryUrl);

    if (!validation.isValid || !validation.projectId) {
      throw new Error(validation.error || '无效的项目URL');
    }

    try {
      console.log(`开始克隆项目: ${validation.projectPath} 到 ${targetPath}`);

      // 下载项目
      const zipPath = await this.downloadRepository(validation.projectId);

      // 解压项目
      const extractedPath = await this.unzipFile(zipPath, targetPath);

      // 清理ZIP文件
      await fs.remove(zipPath);

      console.log(`项目克隆完成: ${extractedPath}`);
      return extractedPath;
    } catch (error) {
      // 清理失败的下载
      if (await fs.pathExists(targetPath)) {
        await fs.remove(targetPath);
      }
      throw new Error(`克隆项目失败: ${error instanceof Error ? error.message : error}`);
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
      throw new Error(`解压文件失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  private extractProjectPath(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除开头和结尾的斜杠，并确保格式正确
      const pathname = urlObj.pathname.replace(/^\/+|\/+$/g, '');

      if (pathname.split('/').length >= 2) {
        return pathname;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}
