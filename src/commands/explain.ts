import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { command } from "@truyman/cli";
import kleur from "kleur";

import { generateExplanation, type ExplainDepth, type ExplainType } from "../lib/ai/index.ts";
import { getCommitDetails, isGitRepository } from "../lib/git/index.ts";
import { GlobalOptions } from "../options.ts";

export const explain = command({
  name: "explain",
  description: "Explain code, commits, or errors using AI",
  inherits: GlobalOptions,
  args: [
    {
      name: "target",
      type: "string",
      description: "File path, commit SHA, or '-' for stdin",
    },
  ] as const,
  options: {
    file: {
      type: "string",
      short: "f",
      description: "Explain a file",
    },
    commit: {
      type: "string",
      short: "c",
      description: "Explain a commit",
    },
    error: {
      type: "boolean",
      short: "e",
      description: "Interpret input as an error message",
    },
    depth: {
      type: "string",
      short: "d",
      description: "Detail level: brief, normal, detailed (default: normal)",
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
  handler: async ([target], options) => {
    const cwd = options.cwd || process.cwd();

    const depth = (options.depth || "normal") as ExplainDepth;
    if (!["brief", "normal", "detailed"].includes(depth)) {
      console.error(kleur.red(`fatal: unknown depth '${depth}'`));
      console.error(kleur.dim("Supported: brief, normal, detailed"));
      process.exit(1);
    }

    let content: string;
    let type: ExplainType;
    let filename: string | undefined;

    if (options.commit) {
      if (!isGitRepository(cwd)) {
        console.error(kleur.red("fatal: not a git repository"));
        process.exit(1);
      }

      const commitDetails = getCommitDetails(options.commit, cwd);
      if (!commitDetails) {
        console.error(kleur.red(`fatal: commit not found: ${options.commit}`));
        process.exit(1);
      }

      content = `Commit: ${commitDetails.info.hash}\nSubject: ${commitDetails.info.subject}\n${commitDetails.info.body ? `\nBody:\n${commitDetails.info.body}\n` : ""}\nDiff:\n${commitDetails.diff}`;
      type = "commit";
      if (options.verbose) {
        console.log(kleur.dim(`Explaining commit ${options.commit.slice(0, 7)}...`));
      }
    } else if (options.file || (target && target !== "-" && !options.error)) {
      const filePath = String(options.file || target);
      const resolvedPath = resolve(cwd, filePath);

      if (!existsSync(resolvedPath)) {
        console.error(kleur.red(`fatal: file not found: ${filePath}`));
        process.exit(1);
      }

      content = readFileSync(resolvedPath, "utf-8");
      type = "file";
      filename = filePath;
      if (options.verbose) {
        console.log(kleur.dim(`Explaining file ${filePath}...`));
      }
    } else if (target === "-" || options.error) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString("utf-8").trim();

      if (!content) {
        console.error(kleur.red("fatal: no input provided"));
        console.error(kleur.dim("Pipe content to stdin or use -f/--file to specify a file"));
        process.exit(1);
      }

      type = options.error ? "error" : "code";
      if (options.verbose) {
        console.log(kleur.dim(`Explaining ${type}...`));
      }
    } else {
      console.error(kleur.red("fatal: nothing to explain"));
      console.error(kleur.dim("Usage: dev explain <file>"));
      console.error(kleur.dim("       dev explain -c <commit>"));
      console.error(kleur.dim("       echo 'code' | dev explain -"));
      console.error(kleur.dim("       echo 'error' | dev explain -e"));
      process.exit(1);
    }

    console.log(kleur.cyan("Generating explanation..."));

    let explanation: string;
    try {
      explanation = await generateExplanation({
        provider: options.provider,
        model: options.model,
        type,
        content,
        filename,
        depth,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`AI error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate explanation"));
      }
      process.exit(1);
    }

    console.log();
    console.log(explanation);
  },
});
