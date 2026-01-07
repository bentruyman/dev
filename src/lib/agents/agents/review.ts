import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";

import { createGitTools } from "../tools/git.ts";
import { createFileTools } from "../tools/files.ts";

export type ReviewFocus = "security" | "performance" | "style" | "bugs" | "all";
export type ReviewSeverity = "info" | "warning" | "error";

export interface ReviewAgentContext {
  mode: "staged" | "commit" | "branch";
  ref?: string; // commit SHA or branch name
  baseBranch?: string;
  focus?: ReviewFocus;
  severity?: ReviewSeverity;
}

export function createReviewAgent(model: LanguageModel, cwd?: string) {
  const gitTools = createGitTools(cwd);
  const fileTools = createFileTools(cwd);

  return new ToolLoopAgent({
    model,
    instructions: `You are an expert code reviewer analyzing code changes.

## Your Process
1. First, get the diff to understand what changed
2. Get the list of changed files
3. For complex changes, read the full file to understand context
4. Look for related files (tests, types, etc.) if needed
5. Perform a thorough review based on the focus area

## Review Areas
When reviewing, consider:
- **Security**: SQL injection, XSS, CSRF, auth issues, data exposure, secrets in code
- **Performance**: Inefficient algorithms, N+1 queries, memory leaks, blocking operations
- **Bugs**: Logic errors, edge cases, null checks, race conditions, error handling
- **Style**: Naming conventions, code organization, readability, patterns

## Output Format
For each issue found, use this format:

### [SEVERITY] Category: Brief Title
**File:** path/to/file.ts:line (if applicable)
**Issue:** Clear description of the problem
**Suggestion:** How to fix it

---

Severity levels:
- **[ERROR]** - Must fix before merging
- **[WARNING]** - Should consider fixing
- **[INFO]** - Suggestion or observation

## Guidelines
- Be specific and actionable
- Reference line numbers when possible
- Explain WHY something is an issue
- Suggest concrete fixes
- Also mention positive aspects of the code
- If no issues found, say so and explain what was checked`,
    tools: {
      getDiff: gitTools.getDiff,
      getStagedChanges: gitTools.getStagedChanges,
      getStagedFiles: gitTools.getStagedFiles,
      getChangedFiles: gitTools.getChangedFiles,
      readFile: fileTools.readFile,
      findFiles: fileTools.findFiles,
      fileExists: fileTools.fileExists,
    },
    stopWhen: stepCountIs(15),
  });
}

export async function runReviewAgent(
  model: LanguageModel,
  context: ReviewAgentContext,
  cwd?: string,
): Promise<string> {
  const agent = createReviewAgent(model, cwd);

  const focusInstructions: Record<ReviewFocus, string> = {
    security: "Focus primarily on security vulnerabilities and data exposure risks.",
    performance: "Focus primarily on performance issues, inefficiencies, and resource usage.",
    style: "Focus primarily on code style, readability, and maintainability.",
    bugs: "Focus primarily on potential bugs, logic errors, and edge cases.",
    all: "Provide a comprehensive review covering security, performance, style, and bugs.",
  };

  let prompt: string;

  switch (context.mode) {
    case "staged":
      prompt = `Review the staged changes (changes ready to be committed).`;
      break;
    case "commit":
      prompt = `Review the changes in commit ${context.ref}.`;
      break;
    case "branch":
      prompt = `Review all changes between ${context.baseBranch || "main"} and ${context.ref || "HEAD"}.`;
      break;
  }

  prompt += `\n\n${focusInstructions[context.focus || "all"]}`;

  if (context.severity) {
    prompt += `\n\nOnly report issues with severity ${context.severity} or higher.`;
  }

  prompt += `\n\nStart by gathering the changes, then perform a thorough code review.`;

  const result = await agent.generate({ prompt });

  return result.text;
}
