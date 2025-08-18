import { saveMarkdownDoc, getMarkdownDoc, publishDocs as publishDocsModel } from '../models/docs';

export class DocsManager {
  static async saveDoc(projectPath: string, docName: string, content: string, language: string): Promise<boolean> {
    try {
      await saveMarkdownDoc(projectPath, docName, content, language, true);
      return true;
    } catch (error) {
      console.error('保存文档失败:', error);
      return false;
    }
  }

  static async getDoc(projectPath: string, docName: string, language: string): Promise<string | null> {
    try {
      console.log('--------', projectPath, docName);
      const doc = await getMarkdownDoc(projectPath, docName, language);
      return doc ? doc.content : null;
    } catch (error) {
      console.error('获取文档失败:', error);
      return null;
    }
  }

  static async publishDocs(projectPath: string): Promise<boolean> {
    try {
      await publishDocsModel(projectPath);
      return true;
    } catch (error) {
      console.error('发布文档失败:', error);
      return false;
    }
  }
}
