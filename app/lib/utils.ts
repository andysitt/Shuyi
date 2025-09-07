import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Schema } from '@google/genai';
import { FunctionDefinition } from 'openai/resources/shared.mjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getLanguageFromExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    php: 'PHP',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    md: 'Markdown',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Bash',
    dockerfile: 'Dockerfile',
    vue: 'Vue',
    svelte: 'Svelte',
  };

  return languageMap[extension || ''] || 'Other';
}

export async function isValidRepositoryUrl(url: string): Promise<boolean> {
  try {
    // 使用API接口验证仓库有效性
    const response = await fetch('/api/platform/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (response.ok) {
      const result = await response.json();
      return result.isValid === true;
    }
    
    // API调用失败时回退到基于URL模式的检测
    const githubUrlPattern = /^(https?:\/\/)?(www\.)?github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_.]+)(\/)?$/;
    const gitlabUrlPattern = /^(https?:\/\/)?(.*gitlab\.[^\/]+|gitlab\.com)\/([a-zA-Z0-9-_]+\/)*([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_.]+)(\/)?$/;
    
    return githubUrlPattern.test(url) || gitlabUrlPattern.test(url);
  } catch (error) {
    // API调用失败时回退到基于URL模式的检测
    const githubUrlPattern = /^(https?:\/\/)?(www\.)?github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_.]+)(\/)?$/;
    const gitlabUrlPattern = /^(https?:\/\/)?(.*gitlab\.[^\/]+|gitlab\.com)\/([a-zA-Z0-9-_]+\/)*([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_.]+)(\/)?$/;
    
    return githubUrlPattern.test(url) || gitlabUrlPattern.test(url);
  }
}

export function extractRepoInfoFromUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }
  return null;
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function groupBy<T, K extends keyof any>(array: T[], key: (item: T) => K): Record<K, T[]> {
  return array.reduce(
    (result, item) => {
      const group = key(item);
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    },
    {} as Record<K, T[]>,
  );
}

export function sortBy<T, K extends keyof T>(array: T[], key: K, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Converts a Google GenAI Schema object to an OpenAI-style FunctionDefinition.
 *
 * @param name - The name of the function.
 * @param schema - The Google GenAI Schema object to convert.
 * @param strict - Whether to enable strict schema adherence.
 * @returns The converted FunctionDefinition object.
 */
export function convertSchemaToFunctionDefinition(
  name: string,
  schema: Schema,
  strict: boolean = false,
): FunctionDefinition {
  // Process properties to lowercase 'type' string values
  const processedProperties = schema.properties
    ? Object.fromEntries(
        Object.entries(schema.properties).map(([key, value]) => {
          let newVaule = { type: value.type?.toString(), ...value };
          if (value.type) {
            newVaule.type = value.type?.toLocaleLowerCase();
          }
          return [key, newVaule];
        }),
      )
    : undefined;

  return {
    name,
    description: schema.description,
    parameters: processedProperties,
    strict: strict || null,
  };
}

type JSONSchema = {
  [key: string]: any;
};
/**
 * 修复 JSON Schema 中的字符串数字，将它们转换为 number
 */
export const fixNumericStrings = (schema: JSONSchema): JSONSchema => {
  const numericKeywords = new Set([
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'minProperties',
    'maxProperties',
    'multipleOf',
  ]);
  if (Array.isArray(schema)) {
    return schema.map((item) => fixNumericStrings(item));
  }

  if (typeof schema === 'object' && schema !== null) {
    const newSchema: JSONSchema = {};
    for (const key in schema) {
      let value = schema[key];

      if (numericKeywords.has(key) && typeof value === 'string' && !isNaN(Number(value))) {
        value = Number(value); // ✅ 转换为数字
      } else if (typeof value === 'object') {
        value = fixNumericStrings(value); // ✅ 递归处理
      }

      newSchema[key] = value;
    }
    return newSchema;
  }

  return schema;
};

export const lowercaseType = (schema: Schema): JSONSchema => {
  const newSchema: JSONSchema = { ...schema };

  for (const key in newSchema) {
    if (!newSchema.hasOwnProperty(key)) continue;

    const value = newSchema[key];

    if (key === 'type' && typeof value === 'string') {
      newSchema[key] = value.toLowerCase();
    } else if (!Array.isArray(value) && typeof value === 'object' && value !== null) {
      newSchema[key] = lowercaseType(value);
    }
  }

  return newSchema;
};

export const DEFAULT_TOKEN_LIMIT = 64_000;

export function tokenLimit(model: string): number {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/gemini-api/docs/models
  switch (model) {
    case 'deepseek-chat':
      return 64_000;
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
