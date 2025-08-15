
import { ToolRegistry } from '@google/gemini-cli-core';
import { DynamicTool } from '@langchain/core/tools';

/**
 * Wraps tools from a ToolRegistry into LangChain DynamicTool objects.
 * This allows existing tools from @google/gemini-cli-core to be used
 * within LangChain agents and chains.
 *
 * @param toolRegistry The ToolRegistry instance containing the tools.
 * @returns An array of DynamicTool instances.
 */
export function wrapToolsForLangChain(toolRegistry: ToolRegistry): DynamicTool[] {
  const tools: DynamicTool[] = [];

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

    if (originalTool) {
      const langChainTool = new DynamicTool({
        name: toolName,
        description: declaration.description || 'No description available.',
        func: async (input: string | object) => { // Add type for input
          try {
            let params = input;
            if (typeof input === 'string') {
              try {
                params = JSON.parse(input);
              } catch (e) {
                console.warn(`Input for tool ${toolName} is a non-JSON string:`, input);
              }
            }
            
            // The original tool.execute expects a signal.
            const controller = new AbortController();
            const result = await originalTool.execute(params, controller.signal);
            
            return result.llmContent || ''; // Ensure we always return a string
          } catch (error: any) {
            return `Error executing tool ${toolName}: ${error.message}`;
          }
        },
      });
      tools.push(langChainTool);
    }
  }

  return tools;
}
