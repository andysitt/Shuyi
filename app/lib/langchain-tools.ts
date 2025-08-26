import { ToolRegistry } from '@google/gemini-cli-core';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as zod from 'zod';
import { resolveRefs } from 'json-refs';
import { format } from 'prettier';
import { schemaToZod } from './schema-to-zod';

/**
 * Wraps tools from a ToolRegistry into LangChain StructuredTool objects.
 * This allows existing tools from @google/gemini-cli-core to be used
 * within LangChain agents and chains, with proper argument schema validation.
 *
 * @param toolRegistry The ToolRegistry instance containing the tools.
 * @returns An array of StructuredTool instances.
 */
export function wrapToolsForLangChain(toolRegistry: ToolRegistry): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = [];

  const toolDeclarations = toolRegistry.getFunctionDeclarations();

  for (const declaration of toolDeclarations) {
    if (!declaration || !declaration.name) {
      continue;
    }
    const toolName = declaration.name;

    // Skip tools that are known to cause issues or are not needed.
    // if (toolName === 'read_many_files') {
    //   continue;
    // }

    const originalTool = toolRegistry.getTool(toolName);

    if (originalTool && declaration.parameters) {
      const zodSchema = schemaToZod(declaration.parameters);

      const langChainTool = new DynamicStructuredTool({
        name: toolName,
        description: declaration.description || 'No description available.',
        schema: zodSchema,
        func: async (input: zod.infer<typeof zodSchema>) => {
          try {
            // The input is now a validated object matching the schema.
            const controller = new AbortController();
            const result = await originalTool.execute(input, controller.signal);

            // Ensure the result is a string, as expected by LangChain.
            if (result.llmContent === null || result.llmContent === undefined) {
              return '';
            }
            if (typeof result.llmContent === 'string') {
              return result.llmContent;
            }
            return JSON.stringify(result.llmContent, null, 2);
          } catch (error: any) {
            return `Error executing tool ${toolName}: ${error.message}`;
          }
        },
      });
      tools.push(langChainTool);
    }
  }

  const saveDocSchema = z.object({
    owner: z.string().describe('The owner of the repository.'),
    repo: z.string().describe('The name of the repository.'),
    docName: z.string().describe('The name of the document to save.'),
    locale: z
      .string()
      .describe(
        "The locale of the content, specified using the IETF BCP 47 language tag format (e.g., 'en-US' for English (United States), 'zh-CN' for Simplified Chinese (China)).",
      ),
    content: z.string().describe('The full content of the document in Markdown format.'),
  });

  const saveDocTool = new DynamicStructuredTool({
    name: 'save_doc',
    description: 'Saves a documentation file to the database.',
    schema: saveDocSchema,
    func: async (input: zod.infer<typeof saveDocSchema>) => {
      try {
        const { DocsManager } = await import('../service/docs-manager');
        const projectPath = `github.com/${input.owner}/${input.repo}`;
        await DocsManager.saveDoc(projectPath, input.docName, input.content, 'en-US');
        return `Document '${input.docName}' was successfully saved to ${projectPath}.`;
      } catch (error: any) {
        return `Error saving document: ${error.message}`;
      }
    },
  });

  tools.push(saveDocTool);

  const getDocSchema = z.object({
    owner: z.string().describe('The owner of the repository.'),
    repo: z.string().describe('The name of the repository.'),
    docName: z.string().describe('The name of the document to retrieve.'),
    locale: z
      .string()
      .describe(
        "The locale of the content, specified using the IETF BCP 47 language tag format (e.g., 'en-US' for English (United States), 'zh-CN' for Simplified Chinese (China)).",
      ),
  });

  const getDocTool = new DynamicStructuredTool({
    name: 'get_doc',
    description: 'Retrieves a documentation file from the database.',
    schema: getDocSchema,
    func: async (input: zod.infer<typeof getDocSchema>) => {
      try {
        const { DocsManager } = await import('../service/docs-manager');
        const projectPath = `github.com/${input.owner}/${input.repo}`;
        const content = await DocsManager.getDoc(projectPath, input.docName.replace('.md', ''), 'en-US');
        if (content) {
          return content;
        } else {
          return `Document '${input.docName}' not found in ${projectPath} for locale '${input.locale}'.`;
        }
      } catch (error: any) {
        return `Error retrieving document: ${error.message}`;
      }
    },
  });

  tools.push(getDocTool);

  return tools;
}
