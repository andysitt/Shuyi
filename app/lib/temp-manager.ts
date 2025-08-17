import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

class TempManager {
  public createTempDirectory(): string {
    const tempDir = os.tmpdir();
    const uniqueDir = `shuyi-analysis-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fullPath = path.join(tempDir, uniqueDir);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
  }

  public async cleanupTempDirectory(directoryPath: string): Promise<void> {
    try {
      if (fs.existsSync(directoryPath)) {
        await fs.promises.rm(directoryPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to clean up temporary directory ${directoryPath}:`, error);
      // Don't throw error, just log it
    }
  }
}

export const tempManager = new TempManager();
