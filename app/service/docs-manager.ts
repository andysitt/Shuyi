import { saveMarkdownDoc, getMarkdownDoc } from '../models/docs';

export class DocsManager {
  static async saveDoc(projectPath: string, docName: string, content: string): Promise<boolean> {
    try {
      await saveMarkdownDoc(projectPath, docName, content);
      return true;
    } catch (error) {
      console.error('保存文档失败:', error);
      return false;
    }
  }

  static async getDoc(projectPath: string, docName: string): Promise<string | null> {
    try {
      const doc = await getMarkdownDoc(projectPath, docName);
      return doc ? doc.content : null;
    } catch (error) {
      console.error('获取文档失败:', error);
      return null;
    }
  }
}