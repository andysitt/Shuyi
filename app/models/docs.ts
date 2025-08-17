import { query, transaction } from '../lib/db';

export interface MarkdownDoc {
  id: number;
  projectPath: string;
  docName: string;
  content: string;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function saveMarkdownDoc(
  projectPath: string,
  docName: string,
  content: string,
  isDraft: boolean = true,
): Promise<MarkdownDoc> {
  const result = await query(
    'INSERT INTO markdown_docs (project_path, doc_name, content, is_draft) VALUES ($1, $2, $3, $4) ON CONFLICT (project_path, doc_name, is_draft) DO UPDATE SET content = $3, is_draft = $4, updated_at = CURRENT_TIMESTAMP RETURNING *',
    [projectPath, docName, content, isDraft],
  );
  return result.rows[0];
}

export async function getMarkdownDoc(projectPath: string, docName: string): Promise<MarkdownDoc | null> {
  const result = await query('SELECT * FROM markdown_docs WHERE project_path = $1 AND doc_name = $2', [
    projectPath,
    docName,
  ]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function publishDocs(projectPath: string): Promise<void> {
  await transaction(async (client) => {
    // Clean up old published documents
    await client.query('DELETE FROM markdown_docs WHERE project_path = $1 AND is_draft = false', [projectPath]);

    // Publish new documents
    await client.query(
      'UPDATE markdown_docs SET is_draft = false, updated_at = CURRENT_TIMESTAMP WHERE project_path = $1 AND is_draft = true',
      [projectPath],
    );
  });
}
