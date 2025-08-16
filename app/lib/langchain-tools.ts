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
export function wrapToolsForLangChain(
  toolRegistry: ToolRegistry,
): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = [];

  const toolDeclarations = toolRegistry.getFunctionDeclarations();

  for (const declaration of toolDeclarations) {
    if (!declaration || !declaration.name) {
      continue;
    }
    const toolName = declaration.name;

    // Skip tools that are known to cause issues or are not needed.
    if (toolName === 'read_many_files') {
      continue;
    }

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
      console.log('-------langChainTool', langChainTool);
      tools.push(langChainTool);
    }
  }
  return tools;
}
