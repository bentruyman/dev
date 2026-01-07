import type { LanguageModel } from "ai";

import { createModel, getProviderConfig, validateApiKey } from "../ai/providers.ts";

export interface AgentConfig {
  provider?: string;
  model?: string;
  cwd?: string;
  verbose?: boolean;
}

export function createAgentModel(config: AgentConfig): LanguageModel {
  const providerConfig = getProviderConfig({
    provider: config.provider,
    model: config.model,
  });

  validateApiKey(providerConfig);

  return createModel(providerConfig);
}

export { createPRAgent } from "./agents/pr.ts";
export { createReviewAgent } from "./agents/review.ts";
export { createDocsAgent } from "./agents/docs.ts";
