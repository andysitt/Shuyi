import { query } from '../lib/db';

export interface MarkdownDoc {
  id: number;
  projectPath: string;
  docName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function saveMarkdownDoc(projectPath: string, docName: string, content: string): Promise<MarkdownDoc> {
  const result = await query(
    'INSERT INTO markdown_docs (project_path, doc_name, content) VALUES ($1, $2, $3) ON CONFLICT (project_path, doc_name) DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP RETURNING *',
    [projectPath, docName, content]
  );
  return result.rows[0];
}

export async function getMarkdownDoc(projectPath: string, docName: string): Promise<MarkdownDoc | null> {
  const result = await query(
    'SELECT * FROM markdown_docs WHERE project_path = $1 AND doc_name = $2',
    [projectPath, docName]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}