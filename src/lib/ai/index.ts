import { generateText } from "ai";

import type { CommitInfo, StagedFile } from "../git/index.ts";
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
