import { command } from "@truyman/cli";
import kleur from "kleur";

import { createAgentModel } from "../lib/agents/index.ts";
import {
  runReviewAgent,
  type ReviewFocus,
  type ReviewSeverity,
} from "../lib/agents/agents/review.ts";
import { getStagedFiles, isGitRepository } from "../lib/git/index.ts";
import { GlobalOptions } from "../options.ts";

export const review = command({
  name: "review",
  description: "AI-powered code review for staged or committed changes",
  inherits: GlobalOptions,
  args: [] as const,
  options: {
    staged: {
      type: "boolean",
      short: "s",
      description: "Review staged changes (default if no other option)",
    },
    commit: {
      type: "string",
      short: "c",
      description: "Review a specific commit",
    },
    branch: {
      type: "string",
      short: "b",
      description: "Review changes between base branch and HEAD",
    },
    focus: {
      type: "string",
      short: "f",
      description: "Focus area: security, performance, style, bugs, all (default: all)",
    },
    severity: {
      type: "string",
      description: "Minimum severity: info, warning, error (default: info)",
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
    const cwd = options.cwd || process.cwd();

    if (!isGitRepository(cwd)) {
      console.error(kleur.red("fatal: not a git repository"));
      process.exit(1);
    }

    const focus = (options.focus || "all") as ReviewFocus;
    if (!["security", "performance", "style", "bugs", "all"].includes(focus)) {
      console.error(kleur.red(`fatal: unknown focus '${focus}'`));
      console.error(kleur.dim("Supported: security, performance, style, bugs, all"));
      process.exit(1);
    }

    const severity = options.severity as ReviewSeverity | undefined;
    if (severity && !["info", "warning", "error"].includes(severity)) {
      console.error(kleur.red(`fatal: unknown severity '${severity}'`));
      console.error(kleur.dim("Supported: info, warning, error"));
      process.exit(1);
    }

    // Quick validation for staged mode
    if (!options.commit && !options.branch) {
      const stagedFiles = getStagedFiles(cwd);
      if (stagedFiles.length === 0) {
        console.error(kleur.red("fatal: no staged changes to review"));
        console.error(kleur.dim("Use 'git add' to stage files, or use --commit or --branch"));
        process.exit(1);
      }
    }

    let mode: "staged" | "commit" | "branch";
    let ref: string | undefined;
    let baseBranch: string | undefined;

    if (options.commit) {
      mode = "commit";
      ref = options.commit;
      if (options.verbose) {
        console.log(kleur.dim(`Reviewing commit ${options.commit}...`));
      }
    } else if (options.branch) {
      mode = "branch";
      baseBranch = options.branch;
      ref = "HEAD";
      if (options.verbose) {
        console.log(kleur.dim(`Reviewing changes since ${options.branch}...`));
      }
    } else {
      mode = "staged";
      if (options.verbose) {
        console.log(kleur.dim("Reviewing staged changes..."));
      }
    }

    console.log(kleur.cyan(`Reviewing code (focus: ${focus})...`));

    let reviewContent: string;

    try {
      const model = createAgentModel({
        provider: options.provider,
        model: options.model,
        cwd,
        verbose: options.verbose,
      });

      reviewContent = await runReviewAgent(
        model,
        {
          mode,
          ref,
          baseBranch,
          focus,
          severity,
        },
        cwd,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`Error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate review"));
      }
      process.exit(1);
    }

    console.log();
    console.log(kleur.bold("Code Review Results"));
    console.log(kleur.dim("─".repeat(40)));
    console.log();
    console.log(reviewContent);
  },
});
