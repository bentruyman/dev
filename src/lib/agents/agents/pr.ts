import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";

import { createGitTools } from "../tools/git.ts";
import { createFileTools } from "../tools/files.ts";

export interface PRAgentContext {
  baseBranch: string;
  headBranch: string;
  includeTitle?: boolean;
  userContext?: string;
}

export function createPRAgent(model: LanguageModel, cwd?: string) {
  const gitTools = createGitTools(cwd);
  const fileTools = createFileTools(cwd);

  return new ToolLoopAgent({
    model,
    instructions: `You are an expert software developer generating a pull request description.

## Your Process
1. First, use getCommits to understand what changes were made
2. Use getDiff to see the actual code changes
3. Use getChangedFiles to see which files were modified
4. If you need more context about specific changes, use readFile to understand the code
5. Analyze for breaking changes, security implications, or notable patterns
6. Generate a comprehensive PR description

## Output Format
Your final response should be a well-structured PR description in markdown:

## Summary
<1-3 sentence overview of what this PR does and why>

## Changes
- <bullet points of key changes, grouped by area if needed>

## Breaking Changes
<list any breaking changes, or omit this section if none>

## Test Plan
- <steps to verify the changes work correctly>

## Guidelines
- Focus on the "why" not just the "what"
- Be concise but complete
- Highlight anything that reviewers should pay special attention to
- If there are multiple logical changes, consider if they should be separate PRs`,
    tools: {
      getCommits: gitTools.getCommits,
      getDiff: gitTools.getDiff,
      getChangedFiles: gitTools.getChangedFiles,
      readFile: fileTools.readFile,
      analyzeCommitStyle: gitTools.analyzeCommitStyle,
    },
    stopWhen: stepCountIs(10),
  });
}

export async function runPRAgent(
  model: LanguageModel,
  context: PRAgentContext,
  cwd?: string,
): Promise<{ title?: string; body: string }> {
  const agent = createPRAgent(model, cwd);

  const prompt = `Generate a pull request description for the following:
- Head branch: ${context.headBranch}
- Base branch: ${context.baseBranch}
${context.includeTitle ? "\nAlso generate a concise PR title as the first line." : ""}
${context.userContext ? `\nAdditional context from the developer:\n${context.userContext}` : ""}

Start by gathering information about the changes, then generate the PR description.`;

  const result = await agent.generate({ prompt });

  if (context.includeTitle) {
    const lines = result.text.split("\n");
    const title = (lines[0] || "").replace(/^#\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    return { title, body };
  }

  return { body: result.text };
}
