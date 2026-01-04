import type { StagedFile } from "../git/index.ts";

export interface PromptContext {
  diff: string;
  stagedFiles: StagedFile[];
  styleGuidelines: string;
  userContext?: string;
}

export function buildCommitMessagePrompt(context: PromptContext): string {
  const filesSummary = context.stagedFiles.map((f) => `${f.status}\t${f.file}`).join("\n");

  return `You are an expert software developer writing a git commit message.

## Task
Analyze the following git diff and generate an appropriate commit message.

## Style Guidelines
${context.styleGuidelines}

## Files Changed
${filesSummary}

## Git Diff
\`\`\`diff
${context.diff}
\`\`\`

${context.userContext ? `## Additional Context from Developer\n${context.userContext}\n` : ""}

## Instructions
1. Write a clear, concise commit message following the style guidelines above
2. The subject line should summarize WHAT changed and WHY (not HOW)
3. Focus on the intent and impact of the changes
4. If the changes are complex, include a body with more details
5. Do not include any markdown formatting, code blocks, or explanatory text
6. Output ONLY the commit message, nothing else

## Output Format
- First line: Subject (imperative mood, ~50-72 chars)
- Blank line (if body follows)
- Body paragraphs (optional, wrap at 72 chars)

Generate the commit message now:`;
}

export function extractCommitMessage(aiResponse: string): string {
  return aiResponse
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .replace(/^(Here'?s?|The|Your) (the )?(commit )?message:?\s*/i, "")
    .trim();
}
