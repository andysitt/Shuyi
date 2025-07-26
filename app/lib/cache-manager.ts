import { createClient } from 'redis'
import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface CacheManager {
  set(key: string, value: any, ttl: number): Promise<void>
  get(key: string): Promise<any>
  delete(key: string): Promise<void>
  clearExpired(): Promise<void>
}

export class RedisCacheManager implements CacheManager {
  private client: ReturnType<typeof createClient> | null = null

  constructor() {
    if (process.env.REDIS_URL) {
      try {
        this.client = createClient({
          url: process.env.REDIS_URL,
        })
        this.client.connect().catch(() => {
          console.warn('Redis连接失败，使用文件系统缓存')
          this.client = null
        })
      } catch (error) {
        console.warn('Redis初始化失败，使用文件系统缓存')
        this.client = null
      }
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis客户端未配置')
    }

    const serializedValue = JSON.stringify(value)
    await this.client.setEx(key, ttl, serializedValue)
  }

  async get(key: string): Promise<any> {
    if (!this.client) {
      return null
    }

    const value = await this.client.get(key)
    return value ? JSON.parse(value) : null
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      return
    }

    await this.client.del(key)
  }

  async clearExpired(): Promise<void> {
    // Redis自动处理过期，无需手动清理
  }
}

export class FileSystemCacheManager implements CacheManager {
  private cacheDir: string

  constructor(cacheDir = '/tmp/github-analyzer-cache') {
    this.cacheDir = cacheDir
    fs.ensureDirSync(this.cacheDir)
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`)
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    const cachePath = this.getCachePath(key)
    const cacheData = {
      value,
      expiry: Date.now() + ttl * 1000,
    }

    await fs.writeJson(cachePath, cacheData)
  }

  async get(key: string): Promise<any> {
    const cachePath = this.getCachePath(key)

    try {
      const cacheData = await fs.readJson(cachePath)
      
      if (Date.now() > cacheData.expiry) {
        await this.delete(key)
        return null
      }

      return cacheData.value
    } catch (error) {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    const cachePath = this.getCachePath(key)
    await fs.remove(cachePath).catch(() => {})
  }

  async clearExpired(): Promise<void> {
    const files = await fs.readdir(this.cacheDir)
    const now = Date.now()

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.cacheDir, file)
        try {
          const cacheData = await fs.readJson(filePath)
          if (now > cacheData.expiry) {
            await fs.remove(filePath)
          }
        } catch (error) {
          // 删除损坏的缓存文件
          await fs.remove(filePath).catch(() => {})
        }
      }
    }
  }
}

export class TempDirectoryManager {
  private baseDir: string

  constructor(baseDir = '/tmp/github-analyzer') {
    this.baseDir = baseDir
    fs.ensureDirSync(this.baseDir)
  }

  createTempDirectory(): string {
    const dirName = `repo-${uuidv4()}`
    const tempDir = path.join(this.baseDir, dirName)
    fs.ensureDirSync(tempDir)
    return tempDir
  }

  async cleanupTempDirectory(dirPath: string): Promise<void> {
    if (dirPath.startsWith(this.baseDir)) {
      await fs.remove(dirPath).catch(console.error)
    }
  }

  async cleanupAll(): Promise<void> {
    const dirs = await fs.readdir(this.baseDir)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    for (const dir of dirs) {
      const dirPath = path.join(this.baseDir, dir)
      try {
        const stats = await fs.stat(dirPath)
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(dirPath)
        }
      } catch (error) {
        console.error(`清理临时目录失败: ${dirPath}`, error)
      }
    }
  }
}

// 创建缓存管理器工厂
export function createCacheManager(): CacheManager {
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    return new RedisCacheManager()
  }
  return new FileSystemCacheManager()
}

// 全局缓存管理器实例
export const cacheManager = createCacheManager()
export const tempManager = new TempDirectoryManager()