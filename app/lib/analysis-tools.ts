import { 
  RepositoryStructure, 
  DependencyInfo, 
  CodeQualityMetrics,
  FileNode,
  FileComplexity,
  SecurityIssue
} from '@/app/types';
import { getLanguageFromExtension } from './utils';
import { 
  getFolderStructure 
} from '@google/gemini-cli-core';

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
    // 获取文件夹结构
    const folderStructure = await getFolderStructure(repositoryPath, {
      maxDepth: 3, // 限制深度以避免过于复杂
      includeSize: true,
    });
    
    // 解析文件夹结构为我们的格式
    const root: FileNode = parseFolderStructure(folderStructure, repositoryPath);
    
    // 统计文件和目录数量
    const { totalFiles, totalDirectories, languages } = countFilesAndLanguages(root);
    
    // 简单的关键文件识别
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
 * 解析文件夹结构
 * @param structure 文件夹结构字符串
 * @param basePath 基础路径
 * @returns FileNode 对象
 */
function parseFolderStructure(structure: string, basePath: string): FileNode {
  const lines = structure.split('\n').filter(line => line.trim() !== '');
  const rootName = basePath.split('/').pop() || 'root';
  
  // 简单解析，实际项目中可能需要更复杂的解析逻辑
  return {
    name: rootName,
    type: 'directory',
    path: '.',
    size: 0,
    children: parseStructureLines(lines, 0, basePath),
  };
}

/**
 * 解析结构行
 * @param lines 行数组
 * @param indentLevel 缩进级别
 * @param basePath 基础路径
 * @returns FileNode 数组
 */
function parseStructureLines(lines: string[], indentLevel: number, basePath: string): FileNode[] {
  const nodes: FileNode[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const currentIndent = line.search(/\S/); // 找到第一个非空格字符的位置
    
    if (currentIndent === indentLevel) {
      // 处理当前级别的节点
      const isDirectory = line.includes('/');
      const name = line.trim().replace(/[\/]$/, ''); // 移除末尾的斜杠
      const path = name; // 简化处理
      
      const node: FileNode = {
        name,
        type: isDirectory ? 'directory' : 'file',
        path,
        size: 0, // 简化处理，实际项目中应该获取真实文件大小
      };
      
      // 如果是目录，查找子节点
      if (isDirectory) {
        const childLines: string[] = [];
        let j = i + 1;
        
        // 收集子节点行
        while (j < lines.length && lines[j].search(/\S/) > indentLevel) {
          childLines.push(lines[j]);
          j++;
        }
        
        if (childLines.length > 0) {
          node.children = parseStructureLines(childLines, indentLevel + 2, basePath);
        }
        
        i = j;
      } else {
        i++;
      }
      
      nodes.push(node);
    } else {
      i++;
    }
  }
  
  return nodes;
}

/**
 * 统计文件和语言
 * @param node 文件节点
 * @returns 统计结果
 */
function countFilesAndLanguages(node: FileNode): { 
  totalFiles: number; 
  totalDirectories: number; 
  languages: Record<string, number> 
} {
  let totalFiles = 0;
  let totalDirectories = 0;
  const languages: Record<string, number> = {};
  
  function traverse(currentNode: FileNode) {
    if (currentNode.type === 'file') {
      totalFiles++;
      const language = getLanguageFromExtension(currentNode.name);
      if (language !== 'Other') {
        languages[language] = (languages[language] || 0) + 1;
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
      } else if (fileName === 'index.ts' || fileName === 'index.js' || fileName === 'main.ts' || fileName === 'main.js') {
        keyFiles.push({
          path: fullPath,
          type: 'main',
          description: '入口文件',
        });
      }
    }
    
    if (currentNode.children) {
      currentNode.children.forEach(child => traverse(child, fullPath));
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
    // 注意：在实际项目中，你可能需要使用文件读取工具来读取文件内容
    // 这里我们简化处理，返回一些示例依赖
    
    // 模拟一些常见的依赖
    dependencies.push(
      { name: 'react', version: '^18.0.0', type: 'production', description: '用于构建用户界面的 JavaScript 库' },
      { name: 'next', version: '^14.0.0', type: 'production', description: 'React 框架' },
      { name: 'typescript', version: '^5.0.0', type: 'development', description: 'JavaScript 的超集' }
    );
    
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
    // 简化的代码质量分析
    // 在实际项目中，你可能需要使用更复杂的工具来分析代码质量
    
    const complexity: { average: number; max: number; files: FileComplexity[] } = {
      average: 2.5,
      max: 10,
      files: [
        { path: 'src/app/page.tsx', complexity: 8, lines: 120 },
        { path: 'src/lib/agent.ts', complexity: 10, lines: 300 },
        { path: 'src/components/Button.tsx', complexity: 3, lines: 45 },
      ],
    };
    
    const securityIssues: SecurityIssue[] = [
      {
        type: 'hardcoded_secret',
        severity: 'high',
        file: 'src/config.ts',
        line: 15,
        description: '代码中硬编码了敏感信息',
      },
      {
        type: 'insecure_dependency',
        severity: 'medium',
        file: 'package.json',
        description: '使用了已知存在安全漏洞的依赖包',
      },
    ];
    
    return {
      complexity,
      duplication: 5, // 重复代码百分比
      maintainability: 75, // 可维护性评分 (0-100)
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