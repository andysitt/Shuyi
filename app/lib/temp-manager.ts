import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class TempManager {
  public createTempDir(prefix: string): string {
    const tempDir = os.tmpdir();
    const uniqueDir = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
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
