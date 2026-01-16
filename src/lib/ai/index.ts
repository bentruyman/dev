import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import type { CommitInfo, FileStats, StagedFile } from "../git/index.ts";
import { createModel, getProviderConfig, validateApiKey } from "./providers.ts";
import {
  buildChangelogPrompt,
  buildCommitMessagePrompt,
  buildDocsPrompt,
  buildExplainPrompt,
  buildPRDescriptionPrompt,
  buildReviewPrompt,
  extractChangelogContent,
  extractCommitMessage,
  extractCommitMessageAgentic,
  extractDocsContent,
  extractExplainContent,
  extractPRContent,
  extractReviewContent,
  type DocsType,
  type ExplainDepth,
} from "./prompts.ts";

export interface GenerateCommitMessageOptions {
  provider?: string;
  model?: string;
  diff: string;
  stagedFiles: StagedFile[];
  styleGuidelines: string;
  userContext?: string;
}

export async function generateCommitMessage(
  options: GenerateCommitMessageOptions,
): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildCommitMessagePrompt({
    diff: options.diff,
    stagedFiles: options.stagedFiles,
    styleGuidelines: options.styleGuidelines,
    userContext: options.userContext,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 500,
    temperature: 0.3,
  });

  return extractCommitMessage(text);
}

export interface GenerateCommitMessageAgenticOptions {
  provider?: string;
  model?: string;
  fileStats: FileStats[];
  styleGuidelines: string;
  userContext?: string;
  getFileDiff: (file: string) => string;
}

export async function generateCommitMessageAgentic(
  options: GenerateCommitMessageAgenticOptions,
): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const filesSummary = options.fileStats
    .map((f) => `${f.status}\t+${f.additions}/-${f.deletions}\t${f.file}`)
    .join("\n");

  const totalAdditions = options.fileStats.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = options.fileStats.reduce((sum, f) => sum + f.deletions, 0);

  const systemPrompt = `You are an expert software developer writing a git commit message.

You have access to a tool that lets you view the diff for specific files. Use it to understand the changes before writing your commit message.

## Style Guidelines
${options.styleGuidelines}

## Strategy
1. Review the file list to understand the scope of changes
2. Use the getFileDiff tool to examine files that seem important or unclear
3. Focus on understanding the PURPOSE of the changes, not just what changed
4. You don't need to view every file - use your judgment to sample representative files
5. When you have enough context, write the commit message

## CRITICAL Output Requirements
Your final response must contain ONLY the commit message itself. Do NOT include:
- Explanations of what you found
- Analysis or reasoning
- Summaries of the changes
- Phrases like "Here's the commit message" or "Based on my analysis"
- Any text before or after the commit message

Format:
- First line: Subject (imperative mood, ~50-72 chars)
- Blank line (if body follows)
- Body paragraphs (optional, wrap at 72 chars)

Example of CORRECT output:
feat: add user authentication module

Implement JWT-based authentication with login, logout, and token refresh
endpoints. Add middleware for protected routes.

Example of INCORRECT output:
Based on my examination, this adds authentication. Here's the commit message:

feat: add user authentication module`;

  const userPrompt = `## Files Changed (${options.fileStats.length} files, +${totalAdditions}/-${totalDeletions} lines)
${filesSummary}

${options.userContext ? `## Additional Context from Developer\n${options.userContext}\n` : ""}

Examine the changes and generate an appropriate commit message.`;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    tools: {
      getFileDiff: tool({
        description:
          "Get the git diff for a specific staged file. Use this to understand what changed in a file.",
        inputSchema: z.object({
          file: z.string().describe("The file path to get the diff for"),
        }),
        execute: async ({ file }: { file: string }) => {
          const diff = options.getFileDiff(file);
          if (!diff) {
            return `No diff found for file: ${file}`;
          }
          return diff;
        },
      }),
    },
    stopWhen: stepCountIs(10),
    maxOutputTokens: 500,
    temperature: 0.3,
  });

  return extractCommitMessageAgentic(text);
}

export interface GeneratePRDescriptionOptions {
  provider?: string;
  model?: string;
  baseBranch: string;
  headBranch: string;
  commits: CommitInfo[];
  diff: string;
  filesChanged: StagedFile[];
  userContext?: string;
  includeTitle?: boolean;
}

export async function generatePRDescription(
  options: GeneratePRDescriptionOptions,
): Promise<{ title?: string; body: string }> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildPRDescriptionPrompt({
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    commits: options.commits,
    diff: options.diff,
    filesChanged: options.filesChanged,
    userContext: options.userContext,
    includeTitle: options.includeTitle,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 1500,
    temperature: 0.3,
  });

  return extractPRContent(text, options.includeTitle ?? false);
}

export interface GenerateChangelogOptions {
  provider?: string;
  model?: string;
  commits: CommitInfo[];
  version?: string;
  previousTag?: string;
  format: "keepachangelog" | "github" | "simple";
}

export async function generateChangelog(options: GenerateChangelogOptions): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildChangelogPrompt({
    commits: options.commits,
    version: options.version,
    previousTag: options.previousTag,
    format: options.format,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.3,
  });

  return extractChangelogContent(text);
}

export type ReviewFocus = "security" | "performance" | "style" | "bugs" | "all";
export type ReviewSeverity = "info" | "warning" | "error";

export interface GenerateReviewOptions {
  provider?: string;
  model?: string;
  diff: string;
  filesChanged: StagedFile[];
  focus?: ReviewFocus;
  severity?: ReviewSeverity;
}

export async function generateReview(options: GenerateReviewOptions): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildReviewPrompt({
    diff: options.diff,
    filesChanged: options.filesChanged,
    focus: options.focus,
    severity: options.severity,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 3000,
    temperature: 0.3,
  });

  return extractReviewContent(text);
}

export type { ExplainDepth };
export type ExplainType = "file" | "commit" | "error" | "code";

export interface GenerateExplainOptions {
  provider?: string;
  model?: string;
  type: ExplainType;
  content: string;
  filename?: string;
  depth: ExplainDepth;
}

export async function generateExplanation(options: GenerateExplainOptions): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildExplainPrompt({
    type: options.type,
    content: options.content,
    filename: options.filename,
    depth: options.depth,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.3,
  });

  return extractExplainContent(text);
}

export type { DocsType };

export interface GenerateDocsOptions {
  provider?: string;
  model?: string;
  code: string;
  filename: string;
  type: DocsType;
  existingDocs?: string;
  update: boolean;
}

export async function generateDocs(options: GenerateDocsOptions): Promise<string> {
  const config = getProviderConfig({
    provider: options.provider,
    model: options.model,
  });

  validateApiKey(config);

  const model = createModel(config);

  const prompt = buildDocsPrompt({
    code: options.code,
    filename: options.filename,
    type: options.type,
    existingDocs: options.existingDocs,
    update: options.update,
  });

  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: 4000,
    temperature: 0.3,
  });

  return extractDocsContent(text);
}
