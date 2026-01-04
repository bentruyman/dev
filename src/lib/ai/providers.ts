import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ProviderName = "anthropic" | "openai";

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  apiKeyEnvVar: string;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4-turbo",
};

export function getProviderConfig(options: { provider?: string; model?: string }): ProviderConfig {
  const providerName = (options.provider ||
    process.env.DEV_AI_PROVIDER ||
    "anthropic") as ProviderName;

  if (providerName !== "anthropic" && providerName !== "openai") {
    throw new Error(`Unknown provider: ${providerName}. Supported: anthropic, openai`);
  }

  const model = options.model || process.env.DEV_AI_MODEL || DEFAULT_MODELS[providerName];

  const apiKeyEnvVar = providerName === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";

  return { name: providerName, model, apiKeyEnvVar };
}

export function validateApiKey(config: ProviderConfig): void {
  const apiKey = process.env[config.apiKeyEnvVar];
  if (!apiKey) {
    throw new Error(`Missing API key. Set ${config.apiKeyEnvVar} environment variable.`);
  }
}

export function createModel(config: ProviderConfig): LanguageModel {
  switch (config.name) {
    case "anthropic":
      return anthropic(config.model);
    case "openai":
      return openai(config.model);
  }
}
