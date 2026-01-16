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

// Conventional commit types that indicate the start of a commit message
const COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

const COMMIT_TYPE_PATTERN = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([^)]+\\))?!?:\\s*.+`, "i");

// Common imperative verbs that start commit messages
const IMPERATIVE_VERBS = [
  "Add",
  "Remove",
  "Update",
  "Fix",
  "Change",
  "Create",
  "Delete",
  "Implement",
  "Improve",
  "Refactor",
  "Move",
  "Rename",
  "Merge",
  "Release",
  "Bump",
  "Initial",
];

const IMPERATIVE_PATTERN = new RegExp(`^(${IMPERATIVE_VERBS.join("|")})\\s+.+`, "i");

export function extractCommitMessageAgentic(aiResponse: string): string {
  const lines = aiResponse.split("\n");

  // Find the line that looks like a commit message subject
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Check for conventional commit format
    if (COMMIT_TYPE_PATTERN.test(line)) {
      // Return from this line to the end, cleaned up
      return lines
        .slice(i)
        .join("\n")
        .replace(/^```[\w]*\n?/gm, "")
        .replace(/```$/gm, "")
        .trim();
    }

    // Check for imperative verb pattern (common in non-conventional commits)
    if (IMPERATIVE_PATTERN.test(line) && line.length <= 100) {
      return lines
        .slice(i)
        .join("\n")
        .replace(/^```[\w]*\n?/gm, "")
        .replace(/```$/gm, "")
        .trim();
    }
  }

  // Fallback to basic extraction if no pattern found
  return extractCommitMessage(aiResponse);
}

export interface PRPromptContext {
  baseBranch: string;
  headBranch: string;
  commits: Array<{ hash: string; subject: string; body: string }>;
  diff: string;
  filesChanged: Array<{ status: string; file: string }>;
  userContext?: string;
  includeTitle?: boolean;
}

export function buildPRDescriptionPrompt(context: PRPromptContext): string {
  const commitsSummary = context.commits
    .map((c) => `- ${c.subject}${c.body ? `\n  ${c.body}` : ""}`)
    .join("\n");

  const filesSummary = context.filesChanged.map((f) => `${f.status}\t${f.file}`).join("\n");

  return `You are an expert software developer writing a pull request description.

## Task
Analyze the following commits and changes, then generate a clear PR description.

## Branch Information
- Base branch: ${context.baseBranch}
- Head branch: ${context.headBranch}
- Number of commits: ${context.commits.length}

## Commits
${commitsSummary}

## Files Changed (${context.filesChanged.length} files)
${filesSummary}

## Git Diff
\`\`\`diff
${context.diff.slice(0, 15000)}${context.diff.length > 15000 ? "\n... (diff truncated)" : ""}
\`\`\`

${context.userContext ? `## Additional Context from Developer\n${context.userContext}\n` : ""}

## Instructions
${context.includeTitle ? "1. Start with a PR title on the first line (concise, descriptive)" : ""}
${context.includeTitle ? "2" : "1"}. Write a clear summary section explaining WHAT this PR does and WHY
${context.includeTitle ? "3" : "2"}. List the key changes as bullet points
${context.includeTitle ? "4" : "3"}. Note any breaking changes if applicable
${context.includeTitle ? "5" : "4"}. Include a brief test plan or verification steps
${context.includeTitle ? "6" : "5"}. Use markdown formatting
${context.includeTitle ? "7" : "6"}. Output ONLY the PR ${context.includeTitle ? "title and " : ""}description, no explanatory text

## Output Format
${context.includeTitle ? "First line: PR Title\n\n" : ""}## Summary
<1-3 sentence overview>

## Changes
- <bullet points of key changes>

## Breaking Changes
<if any, otherwise omit this section>

## Test Plan
- <verification steps>

Generate the PR description now:`;
}

export function extractPRContent(
  aiResponse: string,
  includeTitle: boolean,
): { title?: string; body: string } {
  let text = aiResponse
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .replace(
      /^(Here'?s?|The|Your) (the )?(PR |pull request )?(title and )?(description|body):?\s*/i,
      "",
    )
    .trim();

  if (includeTitle) {
    const lines = text.split("\n");
    const title = (lines[0] || "").replace(/^#\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    return { title, body };
  }

  return { body: text };
}

export interface ChangelogPromptContext {
  commits: Array<{ hash: string; subject: string; body: string }>;
  version?: string;
  previousTag?: string;
  format: "keepachangelog" | "github" | "simple";
}

export function buildChangelogPrompt(context: ChangelogPromptContext): string {
  const commitsList = context.commits
    .map((c) => `- ${c.hash.slice(0, 7)} ${c.subject}${c.body ? `\n  ${c.body}` : ""}`)
    .join("\n");

  const formatInstructions = {
    keepachangelog: `Use Keep a Changelog format (https://keepachangelog.com):
## [${context.version || "Unreleased"}] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Features that will be removed

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes`,
    github: `Use GitHub Release format:
# What's Changed
## New Features
- Feature descriptions with PR references if available

## Bug Fixes
- Bug fix descriptions

## Breaking Changes
- Any breaking changes

**Full Changelog**: comparison link`,
    simple: `Use simple bullet point format:
## ${context.version || "Changes"}
- Change 1
- Change 2
- etc.`,
  };

  return `You are an expert software developer writing a changelog entry.

## Task
Analyze the following commits and generate a changelog entry.

## Context
- Version: ${context.version || "Unreleased"}
${context.previousTag ? `- Since: ${context.previousTag}` : "- Since: beginning of project"}
- Number of commits: ${context.commits.length}

## Commits to Analyze
${commitsList}

## Format Instructions
${formatInstructions[context.format]}

## Guidelines
1. Group commits by type (features, fixes, breaking changes, etc.)
2. Write clear, user-facing descriptions (not commit messages verbatim)
3. Focus on WHAT changed and WHY it matters to users
4. Omit internal/refactoring commits unless they affect users
5. Use past tense (Added, Fixed, Changed)
6. Include commit hashes in parentheses where helpful
7. Output ONLY the changelog entry, no explanatory text

Generate the changelog entry now:`;
}

export function extractChangelogContent(aiResponse: string): string {
  return aiResponse
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .replace(/^(Here'?s?|The|Your) (the )?(changelog|entry):?\s*/i, "")
    .trim();
}

export interface ReviewPromptContext {
  diff: string;
  filesChanged: Array<{ status: string; file: string }>;
  focus?: "security" | "performance" | "style" | "bugs" | "all";
  severity?: "info" | "warning" | "error";
}

export function buildReviewPrompt(context: ReviewPromptContext): string {
  const filesSummary = context.filesChanged.map((f) => `${f.status}\t${f.file}`).join("\n");

  const focusInstructions = {
    security:
      "Focus primarily on security vulnerabilities: injection attacks, XSS, CSRF, authentication issues, data exposure, insecure dependencies.",
    performance:
      "Focus primarily on performance issues: inefficient algorithms, memory leaks, unnecessary re-renders, N+1 queries, blocking operations.",
    style:
      "Focus primarily on code style and maintainability: naming conventions, code organization, readability, documentation, design patterns.",
    bugs: "Focus primarily on bugs and logic errors: edge cases, null checks, race conditions, incorrect assumptions, error handling.",
    all: "Provide a comprehensive review covering security, performance, style, and potential bugs.",
  };

  const severityFilter = context.severity
    ? `Only report issues with severity ${context.severity} or higher.`
    : "Report issues of all severity levels.";

  return `You are an expert code reviewer analyzing a code diff.

## Task
Review the following code changes and identify issues, improvements, and potential problems.

## Files Changed (${context.filesChanged.length} files)
${filesSummary}

## Focus Area
${focusInstructions[context.focus || "all"]}

## Severity Filter
${severityFilter}

## Git Diff
\`\`\`diff
${context.diff.slice(0, 20000)}${context.diff.length > 20000 ? "\n... (diff truncated)" : ""}
\`\`\`

## Instructions
1. Analyze the code changes carefully
2. Identify specific issues with file path and line references where possible
3. Categorize each finding by type (security, performance, bug, style)
4. Assign severity (error, warning, info) to each finding
5. Provide actionable suggestions for fixes
6. Also mention positive aspects of the code where appropriate

## Output Format
Use this format for each finding:

### [SEVERITY] Category: Brief Title
**File:** path/to/file.ts:line
**Issue:** Description of the problem
**Suggestion:** How to fix it

---

If no issues are found, say "No issues found" and briefly explain what was checked.

If the code looks good overall, provide a brief summary of positive observations.

Begin the review:`;
}

export function extractReviewContent(aiResponse: string): string {
  return aiResponse
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .replace(/^(Here'?s?|The|Your) (the )?(code )?review:?\s*/i, "")
    .trim();
}

export type ExplainDepth = "brief" | "normal" | "detailed";

export interface ExplainPromptContext {
  type: "file" | "commit" | "error" | "code";
  content: string;
  filename?: string;
  depth: ExplainDepth;
}

export function buildExplainPrompt(context: ExplainPromptContext): string {
  const depthInstructions = {
    brief: "Provide a brief 2-3 sentence explanation. Be concise.",
    normal: "Provide a clear explanation with key details. Use bullet points where helpful.",
    detailed:
      "Provide a comprehensive explanation including: purpose, how it works, key concepts, potential gotchas, and related context.",
  };

  const typeInstructions = {
    file: `Explain what this file/code does:
- What is its purpose?
- How does it work at a high level?
- What are the key functions/classes/exports?
- How does it fit into the larger codebase?`,
    commit: `Explain this commit:
- What changes were made?
- Why were these changes made (the intent)?
- What is the impact of these changes?
- Are there any notable implementation details?`,
    error: `Explain this error and how to fix it:
- What does this error mean?
- What is the root cause?
- How can it be fixed?
- How can similar errors be prevented?`,
    code: `Explain this code:
- What does it do?
- How does it work?
- What are the inputs and outputs?
- Are there any notable patterns or techniques used?`,
  };

  return `You are an expert software developer explaining code.

## Task
${typeInstructions[context.type]}

## Depth
${depthInstructions[context.depth]}

${context.filename ? `## File\n${context.filename}\n` : ""}

## Content
\`\`\`
${context.content.slice(0, 25000)}${context.content.length > 25000 ? "\n... (content truncated)" : ""}
\`\`\`

## Instructions
1. Explain clearly for a developer who may not be familiar with this code
2. Use technical terms appropriately but explain complex concepts
3. Focus on the "what" and "why", not just the "how"
4. If explaining an error, always include actionable fix suggestions
5. Use markdown formatting for readability

Provide the explanation:`;
}

export function extractExplainContent(aiResponse: string): string {
  return aiResponse
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .replace(/^(Here'?s?|The|Your) (the )?explanation:?\s*/i, "")
    .trim();
}

export type DocsType = "jsdoc" | "readme" | "api";

export interface DocsPromptContext {
  code: string;
  filename: string;
  type: DocsType;
  existingDocs?: string;
  update: boolean;
}

export function buildDocsPrompt(context: DocsPromptContext): string {
  const typeInstructions = {
    jsdoc: `Generate JSDoc/TSDoc comments for all exported functions, classes, and types.
Include:
- @description with a clear explanation of what the code does
- @param for each parameter with type and description
- @returns with type and description
- @throws for any errors that can be thrown
- @example with practical usage examples
- @deprecated if applicable

Output the complete file with documentation added inline.`,
    readme: `Generate a README section for this module/file.
Include:
- Brief description of what this module does
- Installation/import instructions if applicable
- API overview with key exports
- Usage examples with code
- Configuration options if any

Use markdown formatting.`,
    api: `Generate API documentation for this code.
Include:
- Module overview
- Complete function/method signatures
- Parameter descriptions with types
- Return value descriptions
- Example usage for each export
- Related functions/types

Format as markdown documentation.`,
  };

  const updateContext =
    context.update && context.existingDocs
      ? `\n## Existing Documentation to Update\n${context.existingDocs}\n\nUpdate the existing documentation to reflect any changes in the code. Preserve the overall structure but update specific details.`
      : "";

  return `You are an expert technical writer generating documentation.

## Task
${typeInstructions[context.type]}

## File
${context.filename}

## Code
\`\`\`
${context.code}
\`\`\`
${updateContext}

## Guidelines
1. Be accurate - documentation must match the actual code behavior
2. Be concise but complete - include all necessary information
3. Use clear, professional language
4. Include practical examples that developers can copy
5. Document edge cases and important notes
6. For jsdoc type, output the complete file with inline comments
7. For readme/api types, output only the documentation in markdown

Generate the documentation:`;
}

export function extractDocsContent(aiResponse: string): string {
  return aiResponse
    .replace(
      /^(Here'?s?|The|Your) (the )?(generated )?(documentation|docs|JSDoc|comments):?\s*/i,
      "",
    )
    .trim();
}
