import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { command } from "@truyman/cli";
import kleur from "kleur";

import { generateChangelog } from "../lib/ai/index.ts";
import {
  getCommitsBetween,
  getFirstCommit,
  getLatestTag,
  isGitRepository,
} from "../lib/git/index.ts";
import { GlobalOptions } from "../options.ts";

type ChangelogFormat = "keepachangelog" | "github" | "simple";

export const changelog = command({
  name: "changelog",
  description: "Generate changelog entries from commits since last release",
  inherits: GlobalOptions,
  args: [] as const,
  options: {
    since: {
      type: "string",
      description: "Starting point: tag, commit, or 'all' (default: last tag)",
    },
    tag: {
      type: "string",
      short: "t",
      description: "Version/tag label for this changelog entry (e.g., v1.2.0)",
    },
    format: {
      type: "string",
      short: "f",
      description: "Output format: keepachangelog, github, simple (default: keepachangelog)",
    },
    append: {
      type: "boolean",
      short: "a",
      description: "Append to existing CHANGELOG.md",
    },
    output: {
      type: "string",
      short: "o",
      description: "Output file (default: stdout, or CHANGELOG.md with --append)",
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

    const format = (options.format || "keepachangelog") as ChangelogFormat;
    if (!["keepachangelog", "github", "simple"].includes(format)) {
      console.error(kleur.red(`fatal: unknown format '${format}'`));
      console.error(kleur.dim("Supported formats: keepachangelog, github, simple"));
      process.exit(1);
    }

    let startPoint: string;
    let previousTag: string | undefined;

    if (options.since === "all") {
      const firstCommit = getFirstCommit(cwd);
      if (!firstCommit) {
        console.error(kleur.red("fatal: no commits in repository"));
        process.exit(1);
      }
      startPoint = firstCommit;
    } else if (options.since) {
      startPoint = options.since;
      previousTag = options.since;
    } else {
      const latestTag = getLatestTag(cwd);
      if (!latestTag) {
        const firstCommit = getFirstCommit(cwd);
        if (!firstCommit) {
          console.error(kleur.red("fatal: no commits in repository"));
          process.exit(1);
        }
        startPoint = firstCommit;
        if (options.verbose) {
          console.log(kleur.dim("No tags found, using all commits"));
        }
      } else {
        startPoint = latestTag;
        previousTag = latestTag;
        if (options.verbose) {
          console.log(kleur.dim(`Using commits since ${latestTag}`));
        }
      }
    }

    const commits = getCommitsBetween(startPoint, "HEAD", cwd);
    if (commits.length === 0) {
      console.error(kleur.red(`fatal: no commits since ${startPoint}`));
      process.exit(1);
    }

    if (options.verbose) {
      console.log(kleur.dim(`Found ${commits.length} commit(s) to process`));
    }

    console.log(kleur.cyan("Generating changelog..."));

    let changelogContent: string;
    try {
      changelogContent = await generateChangelog({
        provider: options.provider,
        model: options.model,
        commits,
        version: options.tag,
        previousTag,
        format,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(kleur.red(`AI error: ${error.message}`));
      } else {
        console.error(kleur.red("Failed to generate changelog"));
      }
      process.exit(1);
    }

    if (options.append) {
      const changelogPath = options.output || join(cwd, "CHANGELOG.md");

      if (existsSync(changelogPath)) {
        const existing = readFileSync(changelogPath, "utf-8");
        const lines = existing.split("\n");

        let insertIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]?.startsWith("## ") || lines[i]?.startsWith("# ")) {
            if (i > 0) {
              insertIndex = i;
              break;
            }
          }
        }

        if (insertIndex === 0) {
          insertIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() !== "");
          if (insertIndex === -1) insertIndex = lines.length;
        }

        const newContent = [
          ...lines.slice(0, insertIndex),
          changelogContent,
          "",
          ...lines.slice(insertIndex),
        ].join("\n");

        writeFileSync(changelogPath, newContent);
        console.log(kleur.green(`Updated ${changelogPath}`));
      } else {
        const header =
          "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
        writeFileSync(changelogPath, header + changelogContent + "\n");
        console.log(kleur.green(`Created ${changelogPath}`));
      }
    } else if (options.output) {
      writeFileSync(options.output, changelogContent + "\n");
      console.log(kleur.green(`Written to ${options.output}`));
    } else {
      console.log();
      console.log(changelogContent);
    }
  },
});
