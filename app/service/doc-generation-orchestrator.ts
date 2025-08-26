import { Agent } from '../lib/agent';
import { PromptBuilder } from '../lib/llm-tools/prompt-builder';
import { DocsManager } from './docs-manager';
import { progressManager } from './progress-manager';
import {
  AnalysisConfig,
  AnalysisProgress,
  ProjectOverview,
  DependencyGraph,
  CoreFeatures,
  FeatureDocIndex,
  SiteIndexEntry,
  RepoConfig,
  Language,
} from '@/app/types';
import * as fs from 'fs';
import * as path from 'path';

function safeJsonParse(str: string) {
  // 1. 找到第一个 "{" 和最后一个 "}"
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || start >= end) {
    console.log('=========================json parse failed:', str);
    throw new Error('输入中找不到合法的 JSON 包裹符号 { ... }');
  }

  // 2. 裁剪出 JSON 主体
  let jsonStr = str.slice(start, end + 1);

  // // 3. 替换未转义的换行符
  // jsonStr = jsonStr.replace(/(?<!\\)\r?\n/g, '\\n');

  // 4. 尝试解析
  try {
    // 第一次尝试
    return JSON.parse(jsonStr);
  } catch (e) {
    // 记录下失败的数据
    console.log('=========================json parse failed:', jsonStr);
    // const fixed = str.replace(/(?<!\\)?/g, '\\n');
    return JSON.parse(jsonStr);
  }
}
export class DocGenerationOrchestrator {
  private agent: Agent;
  private config: AnalysisConfig;
  private basePath: string;
  private owner: string;
  private repo: string;
  private repositoryUrlEncoded: string;

  constructor(config: AnalysisConfig, repositoryPath: string, repositoryUrl: string, owner: string, repom: string) {
    this.basePath = repositoryPath;
    this.config = config;
    this.agent = new Agent(this.config.llmConfig, this.basePath);
    this.repositoryUrlEncoded = repositoryUrl.replaceAll('http://', '').replaceAll('https://', '');
    this.owner = owner;
    this.repo = repom;
  }

  public async execute(repositoryUrl: string, onProgress?: (progress: AnalysisProgress) => void): Promise<void> {
    console.log('Starting documentation generation for', repositoryUrl);
    try {
      onProgress?.({ stage: 'Starting documentation generation', progress: 5 });

      const overview = await this.runTask1_generateOverview();
      onProgress?.({ stage: 'Generated project overview', progress: 20 });
      console.log('---------------------', overview);

      const dependencies = await this.runTask2_analyzeDependencies(overview);
      onProgress?.({ stage: 'Analyzed dependencies', progress: 40 });
      console.log('---------------------', dependencies);

      const features = await this.runTask3_identifyCoreFeatures(overview, dependencies);
      onProgress?.({ stage: 'Identified core features', progress: 60 });
      console.log('---------------------', features);

      const featureDocs = await this.runTask4_generateFeatureDocs(features);
      onProgress?.({ stage: 'Generated feature documents', progress: 80 });
      console.log('---------------------', featureDocs);

      const siteIndex = await this.runTask5_assembleDocumentation(overview, featureDocs);
      onProgress?.({ stage: 'Assembled documentation site', progress: 100 });

      console.log('Documentation generation finished', siteIndex);

      const docs = await DocsManager.getDocsByPathAndLang(`github.com/${this.owner}/${this.repo}`, 'en-US');
      const cnTitles = [];
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        const docName = await this.translator(doc.doc_name);
        cnTitles.push(docName);
        const docContent = await this.translator(doc.content);
        DocsManager.saveDoc(`github.com/${this.owner}/${this.repo}`, docName, docContent, 'zh-CN');
      }

      // 生成侧边栏
      const outline = docs
        .map((doc) => {
          return `- [${doc.doc_name}](${doc.doc_name}.md)`;
        })
        .join('\n\n');
      const outlineCN = cnTitles
        .map((title) => {
          return `- [${title}](${title}.md)`;
        })
        .join('\n\n');
      const sidebar = `<!-- docs/_sidebar.md -->\n${outline}`;
      const cnSidebar = `<!-- docs/_sidebar.md -->\n${outlineCN}`;
      await DocsManager.saveDoc(`github.com/${this.owner}/${this.repo}`, '_sidebar', sidebar, Language.EN);
      await DocsManager.saveDoc(`github.com/${this.owner}/${this.repo}`, '_sidebar', cnSidebar, Language.ZH_CN);
    } catch (error) {
      console.error('Error during documentation generation:', error);
      onProgress?.({ stage: 'Error', progress: 0, details: error instanceof Error ? error.message : String(error) });
      await progressManager.delete(repositoryUrl);
      throw error;
    }
  }

  private _getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
      if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
        arrayOfFiles = this._getAllFiles(path.join(dirPath, file), arrayOfFiles);
      } else {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    });

    return arrayOfFiles;
  };

  private async runTask1_generateOverview(): Promise<ProjectOverview> {
    try {
      console.log('Running Task 1: Generate Project Overview');
      const filePaths = this._getAllFiles(this.basePath);

      const repoConfig: RepoConfig = {
        root: this.basePath,
        ignoreDirs: ['node_modules', '.git'],
        ignoreGlobs: ['*.lock'],
        maxFileMB: 10,
        langPriorities: ['typescript', 'javascript'],
        exts: ['.ts', '.js'],
      };

      const result = await this.agent.execute({
        actionPrompt: `Given the repository directory and file paths, please:
1) Identify the main modules (at the directory level) and their responsibilities, explaining each in one sentence and listing representative files .
2) Infer the technology stack (language/framework/database/message queue/build tool) and provide evidence paths.
3) Enumerate entry candidates (e.g., main.py, index.tsx, server.ts, bin/cli, Docker CMD), each with a detection reason.
Output the final result in JSON format:
{OUTPUT_EXP}
Only output JSON.`,
        actionPromptParams: {
          owner: this.owner,
          repo: this.repo,
          OUTPUT_EXP:
            '{"modules": [{ "path": string, "role": string, "examples": string[] }],"techStack": [{ "type": "language|framework|db|runtime|build", "name": string, "evidence": string[] }],"entryCandidates": [{ "path": string, "why": string }],"notes": string[]}',
        },
        rolePrompt:
          'You will extract "structure → responsibilities → tech stack → entry candidates" from file lists and path patterns. Do not recite source code, only output conclusions and evidence (file paths/names).',
        jsonOutput: true,
        withEnv: true,
        withTools: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to generate project overview');
      }

      const overview = safeJsonParse(result.content);

      return overview;
    } catch (error) {
      console.error('Error in runTask1_generateOverview:', error);
      throw new Error(`Task 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask2_analyzeDependencies(overview: ProjectOverview): Promise<DependencyGraph> {
    try {
      console.log('Running Task 2: Analyze Dependencies');
      const result = await this.agent.execute({
        actionPrompt: `Based on the following information, build the dependency/call relationships:
- Project Overview: {PROJECT_OVERVIEW_JSON}

Please output:
{OUTPUT_EXP}
Note:
- hotspots: Identify by fan-in + fan-out (the higher, the more core).
- Mermaid: Provide a subgraph with only the core 30 edges to ensure readability.
**Only output JSON.**`,
        actionPromptParams: {
          PROJECT_OVERVIEW_JSON: JSON.stringify(overview, null, 2),
          OUTPUT_EXP:
            '{"moduleGraph": [{ "from": string, "to": string, "type": "import|runtime|io" }],"callGraph": [{ "caller": string, "callee": string, "file": string, "line": number }],"hotspots": [{ "symbol": string, "fanIn": number, "fanOut": number, "files": string[] }],"visual": {"moduleMermaid": "graph LR; ...","callMermaid": "graph LR; ..."}}',
        },
        rolePrompt: 'You will construct dependency/call relationships from the provided information.',
        jsonOutput: true,
        withEnv: true,
        withTools: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to analyze dependencies');
      }

      return safeJsonParse(result.content);
    } catch (error) {
      console.error('Error in runTask2_analyzeDependencies:', error);
      throw new Error(`Task 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask3_identifyCoreFeatures(
    overview: ProjectOverview,
    dependencies: DependencyGraph,
  ): Promise<CoreFeatures> {
    try {
      console.log('Running Task 3: Identify Core Features');
      const result = await this.agent.execute({
        actionPrompt: `Please identify the "Core Features" of the project and score each feature and list the evidence. The following clues can be used:
- Entry points and startup process: {ENTRY_CANDIDATES_FROM_OVERVIEW}
- Module responsibilities: {MODULES_FROM_OVERVIEW}
- Call/dependency hotspots: {HOTSPOTS_FROM_DEPGRAPH}

Output:
{OUTPUT_EXP}
Only output JSON.`,
        actionPromptParams: {
          ENTRY_CANDIDATES_FROM_OVERVIEW: JSON.stringify(overview.entryCandidates, null, 2),
          MODULES_FROM_OVERVIEW: JSON.stringify(overview.modules, null, 2),
          HOTSPOTS_FROM_DEPGRAPH: JSON.stringify(dependencies.hotspots, null, 2),
          OUTPUT_EXP: `{ "features": [{ "id": string,"name": string,"whyCore": string,"importance": number,"evidence": string[],"entryPoints": string[],"primaryModules": string[],"keySymbols": string[]}],"rankingRule": "importance desc, then evidence count desc"}`,
        },
        rolePrompt:
          'Infer "core features" (feature domain/use case level) from the given results; prioritize signals such as entry points, routes, services/use cases, and hot nodes. Output an executable "feature-level" checklist, do not generalize to "tools/libraries".',
        jsonOutput: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to identify core features');
      }

      return safeJsonParse(result.content);
    } catch (error) {
      console.error('Error in runTask3_identifyCoreFeatures:', error);
      throw new Error(`Task 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask4_generateFeatureDocs(features: CoreFeatures): Promise<FeatureDocIndex[]> {
    try {
      console.log('Running Task 4: Generate Feature Docs');
      const featureDocs: FeatureDocIndex[] = [];

      for (const feature of features.features) {
        console.log(`- Generating doc for feature: ${feature.name}`);
        const filesToRead = [...feature.entryPoints, ...feature.primaryModules];
        const outputFileName = `feature_${feature.id}.md`;
        const result = await this.agent.execute({
          actionPrompt: `Target feature: {FEATURE_OBJECT_FROM_TASK3}
Relevant files to analyze: {CODE_SNIPPETS}

Please produce a markdown document with the following sections:
1) A one-sentence summary (≤30 words).
2) Key path tracing: from entry point to core logic and data flow (list symbols/files/line numbers).
3) Complex function breakdown: step-by-step explanation for {KEY_SYMBOLS_OR_FUNCTIONS}.
4) Code snippet explanation: explain the logic piece by piece.
5) Visualization: Mermaid
   - sequenceDiagram (endpoint/service/storage interaction)
   - graph LR call graph (≤30 edges)
6) Risks and improvements: points on maintainability/performance/error handling/security.
7) Appendix: file/symbol index table.

Please output:<content>markdown document content</content>

Only output XML.
`,
          actionPromptParams: {
            owner: this.owner,
            repo: this.repo,
            FEATURE_OBJECT_FROM_TASK3: JSON.stringify(feature, null, 2),
            CODE_SNIPPETS: JSON.stringify(filesToRead),
            KEY_SYMBOLS_OR_FUNCTIONS: JSON.stringify(feature.keySymbols),
            OUTPUT_FILENAME: outputFileName,
            OUTPUT_EXP: `{"id": "${feature.id}","title": "${feature.name}","summary": "...","files": [],"symbols": [],"artifacts": [{ "type":"md","name":"${outputFileName}"}]}`,
          },
          rolePrompt:
            'Write in-depth documentation for engineers: clear, traceable, verifiable. Cite specific files/symbols/line numbers. Generate Mermaid sequence/call diagrams. Explain complex functions with step-by-step pseudocode. Generate a "one-sentence summary" and "notes" where necessary.',
          jsonOutput: false,
        });

        if (!result.success) {
          console.error(`Failed to generate documentation for feature: ${feature.name}`);
          continue;
        }
        const fileName = feature.name.replaceAll(' ', '_');
        DocsManager.saveDoc(
          `github.com/${this.owner}/${this.repo}`,
          fileName,
          result.content.replace('<content>', '').replace('</content>', ''),
          'en-US',
        );
        console.log('result:', result);
        // const docIndex = safeJsonParse(result.content);
        featureDocs.push({
          id: fileName,
          title: fileName,
          artifacts: [{ type: 'md', name: fileName }],
        });
      }

      return featureDocs;
    } catch (error) {
      console.error('Error in runTask4_generateFeatureDocs:', error);
      throw new Error(`Task 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runTask5_assembleDocumentation(
    overview: ProjectOverview,
    featureDocs: FeatureDocIndex[],
  ): Promise<SiteIndexEntry[]> {
    try {
      console.log('Running Task 5: Assemble Documentation');
      const result = await this.agent.execute({
        actionPrompt: `Based on:
- Overview: {PROJECT_OVERVIEW_JSON}
- Feature Index: {FEATURE_INDEX_JSON}

Use the 'get_doc' tool to get feature doc.

Please generate the content for the following markdown files:
1) A master navigation file named 'SUMMARY'.
2) A glossary file named 'GLOSSARY'.
3) An FAQ file named 'FAQ'.
4) Current owner name is {owner}, current repo name is {repo}.

Then, use the 'save_doc' tool to save these markdown files to database, current owner name is {owner}, current repo name is {repo}.

Then, output the following JSON:
{OUTPUT_EXP}
Only output JSON. Do not include the markdown content in the JSON output.`,
        actionPromptParams: {
          owner: this.owner,
          repo: this.repo,
          PROJECT_OVERVIEW_JSON: JSON.stringify(overview, null, 2),
          FEATURE_INDEX_JSON: JSON.stringify(featureDocs, null, 2),
          OUTPUT_EXP: `{"siteIndex": [{ "title": string, "path": string }],"artifacts": [{"type":"md","name":"SUMMARY"},{"type":"md","name":"GLOSSARY"},{"type":"md","name":"FAQ"}]`,
        },
        rolePrompt:
          'Assemble functional documents into a "navigable" overview, and generate a glossary, FAQ, and change impact surface.',
        jsonOutput: true,
      });

      if (!result.success) {
        throw new Error('Agent failed to assemble documentation');
      }

      const assemblyResult = safeJsonParse(result.content);

      return assemblyResult.siteIndex;
    } catch (error) {
      console.error('Error in runTask5_assembleDocumentation:', error);
      throw new Error(`Task 5 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async translator(content: string): Promise<string> {
    const actionPrompt = `
    Please translate the following content
    -----------------------------------
  {content}
    `;
    const agent = new Agent(this.config.llmConfig, this.basePath);
    const result = await agent.execute({
      actionPrompt,
      actionPromptParams: { content },
      rolePrompt: PromptBuilder.SYSTEM_PROMPT_TRANS_TO_CHINESE,
      rolePromptParams: {
        json: PromptBuilder.SYSTEM_PROMPT_WRITER_JSON,
        example: PromptBuilder.SYSTEM_PROMPT_TRANS_TO_CHINESE_EXP,
      },
      jsonOutput: true,
      withEnv: false,
      withTools: false,
    });
    if (!result.success) {
      throw new Error(`Failed to trans doc to : ${result.error}`);
    }

    const docResult = safeJsonParse(result.content);
    console.log('-----docResult', docResult);
    return (docResult as any).document;
  }
}
