import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { command } from "@truyman/cli";
import kleur from "kleur";

import { createAgentModel } from "../lib/agents/index.ts";
import { runDocsAgent, type DocsType } from "../lib/agents/agents/docs.ts";
import { GlobalOptions } from "../options.ts";

export const docs = command({
  name: "docs",
  description: "Generate or update documentation for code",
  inherits: GlobalOptions,
  args: [
    {
      name: "file",
      type: "string",
      description: "File to generate documentation for",
    },
  ] as const,
  options: {
    type: {
      type: "string",
      short: "t",
      description: "Doc type: jsdoc, readme, api (default: jsdoc)",
    },
    output: {
      type: "string",
      short: "o",
      description: "Output file (default: stdout, or overwrite for jsdoc)",
    },
    update: {
      type: "boolean",
      short: "u",
      description: "Update existing docs instead of replacing",
    },
    write: {
      type: "boolean",
      short: "w",
      description: "Write jsdoc directly to the source file",
    },
    dryRun: {
      type: "boolean",
      short: "n",
      description: "Print generated docs without writing",
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
  handler: async ([file], options) => {
    const cwd = options.cwd || process.cwd();

    if (!file || typeof file !== "string") {
      console.error(kleur.red("fatal: file argument is required"));
      process.exit(1);
    }

    const resolvedPath = resolve(cwd, file);

    if (!existsSync(resolvedPath)) {
      console.error(kleur.red(`fatal: file not found: ${file}`));
      process.exit(1);
    }

    const docType = (options.type || "jsdoc") as DocsType;
    if (!["jsdoc", "readme", "api"].includes(docType)) {
      console.error(kleur.red(`fatal: unknown doc type '${docType}'`));
      console.error(kleur.dim("Supported: jsdoc, readme, api"));
      process.exit(1);
    }

    let existingDocs: string | undefined;
    if (options.update && options.output && existsSync(options.output)) {
      existingDocs = readFileSync(resolve(cwd, options.output), "utf-8");
    }

    console.log(kleur.cyan(`Generating ${docType} documentation...`));

    let docsContent: string;

    try {
      const model = createAgentModel({
        provider: options.provider,
        model: options.model,
        cwd,
        verbose: options.verbose,
      });

      docsContent = await runDocsAgent(
        model,
        {
          filePath: resolvedPath,
          type: docType,
          update: options.update,
          existingDocs,
        },
        cwd,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`Error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate documentation"));
      }
      process.exit(1);
    }

    if (options.dryRun) {
      console.log(kleur.dim("--- Generated documentation ---"));
      console.log(docsContent);
      console.log(kleur.dim("--- (dry run, no files written) ---"));
      return;
    }

    if (docType === "jsdoc" && options.write) {
      // For jsdoc, extract the code content if wrapped in code blocks
      let codeContent = docsContent;
      const codeBlockMatch = docsContent.match(
        /```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/,
      );
      if (codeBlockMatch?.[1]) {
        codeContent = codeBlockMatch[1];
      }

      writeFileSync(resolvedPath, codeContent);
      console.log(kleur.green(`Updated ${file} with JSDoc comments`));
    } else if (options.output) {
      const outputPath = resolve(cwd, options.output);
      writeFileSync(outputPath, docsContent + "\n");
      console.log(kleur.green(`Written to ${options.output}`));
    } else {
      console.log();
      console.log(docsContent);
    }
  },
});
