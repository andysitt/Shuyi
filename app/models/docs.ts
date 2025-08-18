import prisma from '../lib/db';
import { MarkdownDoc as PrismaMarkdownDoc } from '@prisma/client';

export interface MarkdownDoc extends PrismaMarkdownDoc {}

export async function saveMarkdownDoc(
  projectPath: string,
  docName: string,
  content: string,
  language: string,
  isDraft: boolean = true,
): Promise<MarkdownDoc> {
  const markdownDoc = await prisma.markdownDoc.upsert({
    where: {
      project_path_doc_name_language_is_draft: {
        project_path: projectPath,
        doc_name: docName,
        language: language,
        is_draft: isDraft,
      },
    },
    update: {
      content,
      is_draft: isDraft,
    },
    create: {
      project_path: projectPath,
      doc_name: docName,
      content,
      language,
      is_draft: isDraft,
    },
  });
  return markdownDoc;
}

export async function getMarkdownDoc(
  projectPath: string,
  docName: string,
  language: string,
): Promise<MarkdownDoc | null> {
  const markdownDoc = await prisma.markdownDoc.findFirst({
    where: {
      project_path: projectPath,
      doc_name: docName,
      language: language,
      is_draft: false,
    },
  });
  return markdownDoc;
}

export async function publishDocs(projectPath: string): Promise<void> {
  await prisma.$transaction(async (prisma) => {
    // Clean up old published documents
    await prisma.markdownDoc.deleteMany({
      where: {
        project_path: projectPath,
        is_draft: false,
      },
    });

    // Publish new documents
    await prisma.markdownDoc.updateMany({
      where: {
        project_path: projectPath,
        is_draft: true,
      },
      data: {
        is_draft: false,
      },
    });
  });
}
