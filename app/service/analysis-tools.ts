import {
  RepositoryStructure,
  DependencyInfo,
  CodeQualityMetrics,
  FileNode,
  FileComplexity,
  SecurityIssue,
} from '@/app/types';
import { getLanguageFromExtension } from '../lib/utils';
import fs from 'fs/promises';
import path from 'path';

// 简单的文件节点接口
interface SimpleFileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size: number;
  children?: SimpleFileNode[];
}

/**
 * 分析仓库结构
 * @param repositoryPath 仓库路径
 * @returns 仓库结构信息
 */
export async function analyzeStructure(repositoryPath: string): Promise<RepositoryStructure> {
  try {
    // 获取真实的文件夹结构
    const root = await buildFileTree(repositoryPath, path.basename(repositoryPath));

    // 统计文件和目录数量
    const { totalFiles, totalDirectories, languages } = countFilesAndLanguages(root);

    // 识别关键文件
    const keyFiles = identifyKeyFiles(root);

    return {
      root,
      totalFiles,
      totalDirectories,
      languages,
      keyFiles,
    };
  } catch (error) {
    console.error('结构分析失败:', error);
    // 返回默认结构
    return {
      root: {
        name: repositoryPath.split('/').pop() || 'root',
        type: 'directory',
        path: '.',
        size: 0,
      },
      totalFiles: 0,
      totalDirectories: 0,
      languages: {},
      keyFiles: [],
    };
  }
}

/**
 * 构建文件树
 * @param dirPath 目录路径
 * @param name 目录名称
 * @returns FileNode 对象
 */
async function buildFileTree(dirPath: string, name: string): Promise<FileNode> {
  const stats = await fs.stat(dirPath);

  const node: FileNode = {
    name,
    type: 'directory',
    path: path.relative(path.dirname(dirPath), dirPath),
    size: stats.size,
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const children: FileNode[] = [];

    // 过滤掉隐藏文件和常见的不需要分析的目录
    const filteredEntries = entries.filter(
      (entry) =>
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'build' &&
        entry.name !== '.next' &&
        entry.name !== '.git',
    );

    for (const entry of filteredEntries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const childNode = await buildFileTree(fullPath, entry.name);
        children.push(childNode);
      } else {
        const fileStats = await fs.stat(fullPath);
        const language = getLanguageFromExtension(entry.name);
        children.push({
          name: entry.name,
          type: 'file',
          path: path.relative(path.dirname(dirPath), fullPath),
          size: fileStats.size,
          language,
        });
      }
    }

    if (children.length > 0) {
      node.children = children;
    }
  } catch (error) {
    console.warn(`无法读取目录 ${dirPath}:`, error);
  }

  return node;
}

/**
 * 统计文件和语言
 * @param node 文件节点
 * @returns 统计结果
 */
function countFilesAndLanguages(node: FileNode): {
  totalFiles: number;
  totalDirectories: number;
  languages: Record<string, number>;
} {
  let totalFiles = 0;
  let totalDirectories = 0;
  const languages: Record<string, number> = {};

  function traverse(currentNode: FileNode) {
    if (currentNode.type === 'file') {
      totalFiles++;
      if (currentNode.language && currentNode.language !== 'Other') {
        languages[currentNode.language] = (languages[currentNode.language] || 0) + 1;
      }
    } else {
      totalDirectories++;
    }

    if (currentNode.children) {
      currentNode.children.forEach(traverse);
    }
  }

  traverse(node);

  return { totalFiles, totalDirectories, languages };
}

/**
 * 识别关键文件
 * @param node 文件节点
 * @returns 关键文件列表
 */
function identifyKeyFiles(node: FileNode): any[] {
  const keyFiles: any[] = [];

  function traverse(currentNode: FileNode, currentPath: string) {
    const fullPath = currentPath ? `${currentPath}/${currentNode.name}` : currentNode.name;
    const fileName = currentNode.name.toLowerCase();

    // 识别关键文件类型
    if (currentNode.type === 'file') {
      if (fileName === 'package.json') {
        keyFiles.push({
          path: fullPath,
          type: 'package',
          description: '项目依赖配置文件',
        });
      } else if (fileName === 'readme.md' || fileName === 'readme') {
        keyFiles.push({
          path: fullPath,
          type: 'readme',
          description: '项目说明文档',
        });
      } else if (fileName === 'tsconfig.json' || fileName === 'jsconfig.json') {
        keyFiles.push({
          path: fullPath,
          type: 'config',
          description: 'TypeScript/JavaScript 配置文件',
        });
      } else if (
        fileName === 'index.ts' ||
        fileName === 'index.js' ||
        fileName === 'main.ts' ||
        fileName === 'main.js'
      ) {
        keyFiles.push({
          path: fullPath,
          type: 'main',
          description: '入口文件',
        });
      } else if (fileName === 'dockerfile') {
        keyFiles.push({
          path: fullPath,
          type: 'config',
          description: 'Docker 配置文件',
        });
      } else if (fileName === '.gitignore') {
        keyFiles.push({
          path: fullPath,
          type: 'config',
          description: 'Git 忽略文件配置',
        });
      }
    }

    if (currentNode.children) {
      currentNode.children.forEach((child) => traverse(child, fullPath));
    }
  }

  traverse(node, '');

  return keyFiles;
}

/**
 * 分析依赖信息
 * @param repositoryPath 仓库路径
 * @returns 依赖信息数组
 */
export async function analyzeDependencies(repositoryPath: string): Promise<DependencyInfo[]> {
  try {
    const dependencies: DependencyInfo[] = [];

    // 尝试读取 package.json 文件
    try {
      const packageJsonPath = path.join(repositoryPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // 处理生产依赖
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'production',
          });
        }
      }

      // 处理开发依赖
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'development',
          });
        }
      }

      // 处理 peer 依赖
      if (packageJson.peerDependencies) {
        for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'peer',
          });
        }
      }
    } catch (error) {
      console.warn('无法读取 package.json 文件:', error);
    }

    // 尝试读取 requirements.txt (Python)
    try {
      const requirementsPath = path.join(repositoryPath, 'requirements.txt');
      const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
      const lines = requirementsContent.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#'));

      for (const line of lines) {
        const [name, version] = line.split('==');
        if (name) {
          dependencies.push({
            name: name.trim(),
            version: version ? version.trim() : 'latest',
            type: 'production',
          });
        }
      }
    } catch (error) {
      console.warn('无法读取 requirements.txt 文件:', error);
    }

    // 尝试读取 pom.xml (Java/Maven)
    try {
      const pomPath = path.join(repositoryPath, 'pom.xml');
      const pomContent = await fs.readFile(pomPath, 'utf-8');
      // 简单的 XML 解析，实际项目中应该使用专门的 XML 解析库
      const dependencyMatches = pomContent.match(/<dependency>([\s\S]*?)<\/dependency>/g);

      if (dependencyMatches) {
        for (const match of dependencyMatches) {
          const groupIdMatch = match.match(/<groupId>(.*?)<\/groupId>/);
          const artifactIdMatch = match.match(/<artifactId>(.*?)<\/artifactId>/);
          const versionMatch = match.match(/<version>(.*?)<\/version>/);

          if (artifactIdMatch) {
            dependencies.push({
              name: artifactIdMatch[1],
              version: versionMatch ? versionMatch[1] : 'latest',
              type: 'production',
            });
          }
        }
      }
    } catch (error) {
      console.warn('无法读取 pom.xml 文件:', error);
    }

    return dependencies;
  } catch (error) {
    console.error('依赖分析失败:', error);
    return [];
  }
}

/**
 * 分析代码质量
 * @param repositoryPath 仓库路径
 * @returns 代码质量指标
 */
export async function analyzeCodeQuality(repositoryPath: string): Promise<CodeQualityMetrics> {
  try {
    const files: FileComplexity[] = [];
    let totalComplexity = 0;
    let maxComplexity = 0;
    const securityIssues: SecurityIssue[] = [];
    const fileContents: string[] = []; // 用于存储文件内容以进行重复分析

    // 遍历文件并分析复杂度
    const analyzeDirectory = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          // 跳过不需要分析的目录
          if (
            entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.next' ||
            entry.name === '.git'
          ) {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await analyzeDirectory(fullPath);
          } else if (entry.isFile()) {
            // 只分析代码文件
            const ext = path.extname(entry.name).toLowerCase();
            const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs'];

            if (codeExtensions.includes(ext)) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                fileContents.push(content); // 存储内容
                const lines = content.split('\n');
                const lineCount = lines.length;

                // 简单的复杂度计算（基于函数数量和嵌套深度）
                let complexity = 1; // 基础复杂度
                let functionCount = 0;

                // 计算函数数量
                if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
                  functionCount = (content.match(/function\s+|=>|\w+\s*\([^)]*\)\s*\{/g) || []).length;
                } else if (ext === '.py') {
                  functionCount = (content.match(/def\s+\w+\s*\(/g) || []).length;
                } else if (ext === '.java' || ext === '.cpp' || ext === '.c') {
                  functionCount = (content.match(/\w+\s+\w+\s*\([^)]*\)\s*\{/g) || []).length;
                }

                complexity += Math.floor(functionCount / 2); // 每2个函数增加1点复杂度

                // 基于嵌套深度增加复杂度
                let maxDepth = 0;
                let currentDepth = 0;
                for (const line of lines) {
                  if (line.includes('{') || line.includes('(')) {
                    currentDepth++;
                    maxDepth = Math.max(maxDepth, currentDepth);
                  }
                  if (line.includes('}') || line.includes(')')) {
                    currentDepth = Math.max(0, currentDepth - 1);
                  }
                }
                complexity += Math.floor(maxDepth / 3); // 每3层嵌套增加1点复杂度

                // 限制复杂度在合理范围内
                complexity = Math.min(complexity, 200);

                files.push({
                  path: path.relative(repositoryPath, fullPath),
                  complexity,
                  lines: lineCount,
                });

                totalComplexity += complexity;
                maxComplexity = Math.max(maxComplexity, complexity);

                // 检查安全问题
                checkSecurityIssues(content, path.relative(repositoryPath, fullPath), securityIssues);
              } catch (error) {
                console.warn(`无法读取文件 ${fullPath}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`无法读取目录 ${dirPath}:`, error);
      }
    };

    await analyzeDirectory(repositoryPath);

    // 计算平均复杂度
    const averageComplexity = files.length > 0 ? totalComplexity / files.length : 0;

    // 计算重复代码
    const duplication = calculateDuplication(fileContents);

    // 计算可维护性评分 (0-100)
    const maintainability = Math.max(0, 100 - averageComplexity * 5 - duplication);

    return {
      complexity: {
        average: parseFloat(averageComplexity.toFixed(1)),
        max: maxComplexity,
        files: files.sort((a, b) => b.complexity - a.complexity).slice(0, 10), // 只返回前10个最复杂的文件
      },
      duplication,
      maintainability: Math.round(maintainability),
      securityIssues,
    };
  } catch (error) {
    console.error('代码质量分析失败:', error);
    // 返回默认质量指标
    return {
      complexity: {
        average: 0,
        max: 0,
        files: [],
      },
      duplication: 0,
      maintainability: 0,
      securityIssues: [],
    };
  }
}

/**
 * 计算代码重复率
 * @param fileContents 所有文件内容组成的数组
 * @returns 重复率百分比
 */
function calculateDuplication(fileContents: string[]): number {
  const lineCounts = new Map<string, number>();
  let totalLines = 0;

  for (const content of fileContents) {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      // 忽略空行和过短的行（可能是括号等），只统计有意义的代码行
      if (trimmedLine.length > 10) {
        totalLines++;
        lineCounts.set(trimmedLine, (lineCounts.get(trimmedLine) || 0) + 1);
      }
    }
  }

  let duplicatedLines = 0;
  Array.from(lineCounts.values()).forEach((count) => {
    if (count > 1) {
      // 如果一行出现了N次，那么有N行是重复的
      duplicatedLines += count;
    }
  });

  if (totalLines === 0) {
    return 0;
  }

  const duplicationPercentage = (duplicatedLines / totalLines) * 100;
  return Math.round(duplicationPercentage);
}

/**
 * 检查安全问题
 * @param content 文件内容
 * @param filePath 文件路径
 * @param issues 安全问题数组
 */
function checkSecurityIssues(content: string, filePath: string, issues: SecurityIssue[]) {
  // 检查硬编码的密钥
  const secretPatterns = [
    /password\s*=\s*['"][^'"]+['"]/gi,
    /secret\s*=\s*['"][^'"]+['"]/gi,
    /api[key]?\s*=\s*['"][^'"]+['"]/gi,
    /token\s*=\s*['"][^'"]+['"]/gi,
  ];

  for (const pattern of secretPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        type: 'hardcoded_secret',
        severity: 'high',
        file: filePath,
        description: '代码中可能硬编码了敏感信息',
      });
    }
  }

  // 检查 console.log 语句（在生产代码中不应该有）
  const consoleLogMatches = content.match(/console\.log/g);
  if (consoleLogMatches && consoleLogMatches.length > 5) {
    issues.push({
      type: 'debug_code',
      severity: 'medium',
      file: filePath,
      description: '文件中包含过多的 console.log 语句',
    });
  }

  // 检查 eval 使用
  if (content.includes('eval(')) {
    issues.push({
      type: 'unsafe_eval',
      severity: 'high',
      file: filePath,
      description: '代码中使用了不安全的 eval 函数',
    });
  }
}
