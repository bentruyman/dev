import { command } from "@truyman/cli";
import kleur from "kleur";

import { generateCommitMessage } from "../lib/ai/index.ts";
import { openInEditor } from "../lib/editor.ts";
import {
  createCommit,
  getCurrentBranch,
  getRecentCommits,
  getStagedDiff,
  getStagedFiles,
  isGitRepository,
  stageAllChanges,
} from "../lib/git/index.ts";
import { analyzeCommitStyle, styleToPromptGuidelines } from "../lib/git/style.ts";
import { GlobalOptions } from "../options.ts";

export const commit = command({
  name: "commit",
  description: "Generate an AI-powered commit message for staged changes",
  inherits: GlobalOptions,
  args: [] as const,
  options: {
    all: {
      type: "boolean",
      short: "a",
      description: "Stage all modified and deleted files before committing",
    },
    message: {
      type: "string",
      short: "m",
      description: "Additional context or instructions for the AI",
    },
    noEdit: {
      type: "boolean",
      description: "Skip editor and commit with generated message directly",
    },
    dryRun: {
      type: "boolean",
      short: "n",
      description: "Print generated message without committing",
    },
    provider: {
      type: "string",
      description: "AI provider to use (anthropic, openai)",
    },
    model: {
      type: "string",
      description: "Specific model to use",
    },
  },
  handler: async ([], options) => {
    const cwd = options.cwd;

    if (!isGitRepository(cwd)) {
      console.error(kleur.red("fatal: not a git repository"));
      process.exit(1);
    }

    if (options.all) {
      if (options.verbose) {
        console.log(kleur.dim("Staging modified and deleted files..."));
      }
      stageAllChanges(cwd);
    }

    const stagedFiles = getStagedFiles(cwd);
    if (stagedFiles.length === 0) {
      console.error(kleur.red("nothing to commit (no staged changes)"));
      console.error(kleur.dim("Use 'git add' to stage files, or use --all/-a flag"));
      process.exit(1);
    }

    if (options.verbose) {
      console.log(kleur.dim(`Analyzing ${stagedFiles.length} staged file(s)...`));
    }

    const diff = getStagedDiff(cwd);
    const recentCommits = getRecentCommits(10, cwd);

    const style = analyzeCommitStyle(recentCommits);
    const styleGuidelines = styleToPromptGuidelines(style);

    if (options.verbose) {
      console.log(kleur.dim("Detected commit style:"));
      console.log(kleur.dim(`  - Conventional commits: ${style.usesConventionalCommits}`));
      console.log(kleur.dim(`  - Average length: ${style.averageSubjectLength} chars`));
    }

    console.log(kleur.cyan("Generating commit message..."));

    let generatedMessage: string;
    try {
      generatedMessage = await generateCommitMessage({
        provider: options.provider,
        model: options.model,
        diff,
        stagedFiles,
        styleGuidelines,
        userContext: options.message,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`AI error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate commit message"));
      }
      process.exit(1);
    }

    if (options.dryRun) {
      console.log(kleur.dim("--- Generated commit message ---"));
      console.log(generatedMessage);
      console.log(kleur.dim("--- (dry run, no commit created) ---"));
      return;
    }

    let finalMessage: string;

    if (options.noEdit) {
      finalMessage = generatedMessage;
    } else {
      const branch = getCurrentBranch(cwd);
      const editorResult = openInEditor(generatedMessage, branch);

      if (editorResult.aborted) {
        console.log(kleur.yellow("Aborting commit due to empty commit message."));
        process.exit(0);
      }

      finalMessage = editorResult.message;
    }

    try {
      const hash = createCommit(finalMessage, cwd);
      const subject = finalMessage.split("\n")[0];
      console.log(kleur.green(`[${hash.slice(0, 7)}] ${subject}`));
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`git commit failed: ${error.message}`));
      }
      process.exit(1);
    }
  },
});
