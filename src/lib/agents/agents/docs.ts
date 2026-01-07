import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";

import { createFileTools } from "../tools/files.ts";

export type DocsType = "jsdoc" | "readme" | "api";

export interface DocsAgentContext {
  filePath: string;
  type: DocsType;
  update?: boolean;
  existingDocs?: string;
}

export function createDocsAgent(model: LanguageModel, cwd?: string) {
  const fileTools = createFileTools(cwd);

  return new ToolLoopAgent({
    model,
    instructions: `You are an expert technical writer generating documentation for code.

## Your Process
1. Read the target file to understand its contents
2. Find related files (imports, types, tests) for additional context
3. Check for existing documentation patterns in the codebase
4. Generate comprehensive documentation

## Documentation Types

### JSDoc/TSDoc
Generate inline documentation comments for:
- All exported functions, classes, and types
- Include @description, @param, @returns, @throws, @example
- Follow existing patterns if present

### README
Generate a README section including:
- Module description
- Installation/import instructions
- API overview with key exports
- Usage examples with code
- Configuration options if applicable

### API Documentation
Generate detailed API docs including:
- Module overview
- Function/method signatures
- Parameter descriptions with types
- Return value descriptions
- Usage examples
- Related functions/types

## Guidelines
- Be accurate - documentation must match the actual code
- Be concise but complete
- Use clear, professional language
- Include practical, copy-paste-ready examples
- Document edge cases and important notes
- Match existing documentation style in the project`,
    tools: {
      readFile: fileTools.readFile,
      listFiles: fileTools.listFiles,
      findFiles: fileTools.findFiles,
      fileExists: fileTools.fileExists,
      getFileInfo: fileTools.getFileInfo,
    },
    stopWhen: stepCountIs(10),
  });
}

export async function runDocsAgent(
  model: LanguageModel,
  context: DocsAgentContext,
  cwd?: string,
): Promise<string> {
  const agent = createDocsAgent(model, cwd);

  const typeInstructions: Record<DocsType, string> = {
    jsdoc:
      "Generate JSDoc/TSDoc comments for all exports. Output the complete file with documentation inline.",
    readme: "Generate a README section in markdown format.",
    api: "Generate detailed API documentation in markdown format.",
  };

  let prompt = `Generate ${context.type} documentation for the file: ${context.filePath}

${typeInstructions[context.type]}`;

  if (context.update && context.existingDocs) {
    prompt += `\n\nExisting documentation to update:\n${context.existingDocs}\n\nUpdate the documentation to reflect current code while preserving structure.`;
  }

  prompt += `\n\nStart by reading the file and any related files to understand the code, then generate the documentation.`;

  const result = await agent.generate({ prompt });

  return result.text;
}
