import { command } from "@truyman/cli";
import kleur from "kleur";

import { createAgentModel } from "../lib/agents/index.ts";
import { runPRAgent } from "../lib/agents/agents/pr.ts";
import { openInEditor } from "../lib/editor.ts";
import {
  getCommitsBetween,
  getCurrentBranch,
  getDefaultBranch,
  isGitRepository,
} from "../lib/git/index.ts";
import { GlobalOptions } from "../options.ts";

export const pr = command({
  name: "pr",
  description: "Generate an AI-powered pull request description",
  inherits: GlobalOptions,
  args: [] as const,
  options: {
    base: {
      type: "string",
      short: "b",
      description: "Target base branch (default: auto-detect main/master)",
    },
    title: {
      type: "boolean",
      short: "t",
      description: "Also generate a PR title",
    },
    message: {
      type: "string",
      short: "m",
      description: "Additional context or instructions for the AI",
    },
    dryRun: {
      type: "boolean",
      short: "n",
      description: "Print generated description without creating PR",
    },
    noEdit: {
      type: "boolean",
      description: "Skip editor and output directly",
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

    const headBranch = getCurrentBranch(cwd);
    if (!headBranch) {
      console.error(kleur.red("fatal: not on a branch (detached HEAD)"));
      process.exit(1);
    }

    const baseBranch = options.base || getDefaultBranch(cwd);

    if (headBranch === baseBranch) {
      console.error(kleur.red(`fatal: already on ${baseBranch}, nothing to compare`));
      console.error(kleur.dim("Create a feature branch first, then run this command"));
      process.exit(1);
    }

    // Quick validation that there are commits to describe
    const commits = getCommitsBetween(baseBranch, "HEAD", cwd);
    if (commits.length === 0) {
      console.error(kleur.red(`fatal: no commits between ${baseBranch} and ${headBranch}`));
      process.exit(1);
    }

    if (options.verbose) {
      console.log(kleur.dim(`Comparing ${headBranch} against ${baseBranch}...`));
    }

    console.log(kleur.cyan("Generating PR description..."));

    let prContent: { title?: string; body: string };

    try {
      const model = createAgentModel({
        provider: options.provider,
        model: options.model,
        cwd,
        verbose: options.verbose,
      });

      prContent = await runPRAgent(
        model,
        {
          baseBranch,
          headBranch,
          includeTitle: options.title,
          userContext: options.message,
        },
        cwd,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`Error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate PR description"));
      }
      process.exit(1);
    }

    if (options.dryRun || options.noEdit) {
      console.log(kleur.dim("--- Generated PR ---"));
      if (prContent.title) {
        console.log(kleur.bold(`Title: ${prContent.title}`));
        console.log();
      }
      console.log(prContent.body);
      if (options.dryRun) {
        console.log(kleur.dim("--- (dry run, no PR created) ---"));
      }
      return;
    }

    const editorContent = prContent.title
      ? `${prContent.title}\n\n${prContent.body}`
      : prContent.body;

    const editorResult = openInEditor(editorContent, `PR: ${headBranch} -> ${baseBranch}`);

    if (editorResult.aborted) {
      console.log(kleur.yellow("Aborting PR due to empty description."));
      process.exit(0);
    }

    const finalContent = editorResult.message;
    const lines = finalContent.split("\n");
    const finalTitle = options.title ? lines[0] : undefined;
    const finalBody = options.title ? lines.slice(2).join("\n") : finalContent;

    console.log(kleur.dim("--- Final PR Description ---"));
    if (finalTitle) {
      console.log(kleur.bold(`Title: ${finalTitle}`));
      console.log();
    }
    console.log(finalBody);
    console.log(kleur.dim("---"));
    console.log();
    console.log(kleur.green("PR description ready!"));
    console.log(kleur.dim("Copy the above or use 'gh pr create' to create the PR"));
  },
});
