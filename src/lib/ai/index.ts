import { generateText } from "ai";

import type { StagedFile } from "../git/index.ts";
import { createModel, getProviderConfig, validateApiKey } from "./providers.ts";
import { buildCommitMessagePrompt, extractCommitMessage } from "./prompts.ts";

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
    maxTokens: 500,
    temperature: 0.3,
  });

  return extractCommitMessage(text);
}
