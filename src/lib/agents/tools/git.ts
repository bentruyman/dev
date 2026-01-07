import { tool } from "ai";
import { z } from "zod";

import {
  getCommitsBetween,
  getCurrentBranch,
  getDefaultBranch,
  getDiffBetween,
  getFilesChangedBetween,
  getRecentCommits,
  getStagedDiff,
  getStagedFiles,
} from "../../git/index.ts";
import { analyzeCommitStyle, styleToPromptGuidelines } from "../../git/style.ts";

export function createGitTools(cwd?: string) {
  return {
    getDiff: tool({
      description: "Get the git diff between two refs (branches, commits, or tags)",
      inputSchema: z.object({
        base: z.string().describe("Base ref (branch name, commit SHA, or tag)"),
        head: z.string().optional().describe("Head ref (default: HEAD)"),
      }),
      execute: async ({ base, head }) => {
        const diff = getDiffBetween(base, head || "HEAD", cwd);
        if (!diff) {
          return "No differences found between the refs.";
        }
        // Truncate if too large
        if (diff.length > 50000) {
          return diff.slice(0, 50000) + "\n... (diff truncated due to size)";
        }
        return diff;
      },
    }),

    getCommits: tool({
      description: "Get the list of commits between two refs",
      inputSchema: z.object({
        base: z.string().describe("Base ref"),
        head: z.string().optional().describe("Head ref (default: HEAD)"),
      }),
      execute: async ({ base, head }) => {
        const commits = getCommitsBetween(base, head || "HEAD", cwd);
        if (commits.length === 0) {
          return "No commits found between the refs.";
        }
        return commits.map((c) => ({
          hash: c.hash.slice(0, 7),
          subject: c.subject,
          body: c.body || undefined,
        }));
      },
    }),

    getChangedFiles: tool({
      description: "Get the list of files changed between two refs",
      inputSchema: z.object({
        base: z.string().describe("Base ref"),
        head: z.string().optional().describe("Head ref (default: HEAD)"),
      }),
      execute: async ({ base, head }) => {
        const files = getFilesChangedBetween(base, head || "HEAD", cwd);
        if (files.length === 0) {
          return "No files changed between the refs.";
        }
        return files.map((f) => ({
          status: f.status,
          file: f.file,
        }));
      },
    }),

    getStagedChanges: tool({
      description: "Get the staged diff (changes ready to be committed)",
      inputSchema: z.object({}),
      execute: async () => {
        const diff = getStagedDiff(cwd);
        if (!diff) {
          return "No staged changes.";
        }
        if (diff.length > 50000) {
          return diff.slice(0, 50000) + "\n... (diff truncated due to size)";
        }
        return diff;
      },
    }),

    getStagedFiles: tool({
      description: "Get the list of staged files",
      inputSchema: z.object({}),
      execute: async () => {
        const files = getStagedFiles(cwd);
        if (files.length === 0) {
          return "No files staged.";
        }
        return files.map((f) => ({
          status: f.status,
          file: f.file,
        }));
      },
    }),

    getCurrentBranch: tool({
      description: "Get the current git branch name",
      inputSchema: z.object({}),
      execute: async () => {
        const branch = getCurrentBranch(cwd);
        return branch || "Not on a branch (detached HEAD)";
      },
    }),

    getDefaultBranch: tool({
      description: "Get the default branch name (main or master)",
      inputSchema: z.object({}),
      execute: async () => {
        return getDefaultBranch(cwd);
      },
    }),

    getRecentCommits: tool({
      description: "Get recent commits from the repository",
      inputSchema: z.object({
        count: z.number().optional().describe("Number of commits to retrieve (default: 10)"),
      }),
      execute: async ({ count }) => {
        const commits = getRecentCommits(count || 10, cwd);
        if (commits.length === 0) {
          return "No commits found.";
        }
        return commits.map((c) => ({
          hash: c.hash.slice(0, 7),
          subject: c.subject,
          body: c.body || undefined,
        }));
      },
    }),

    analyzeCommitStyle: tool({
      description: "Analyze the commit style of the repository based on recent commits",
      inputSchema: z.object({}),
      execute: async () => {
        const commits = getRecentCommits(10, cwd);
        if (commits.length === 0) {
          return "No commits to analyze.";
        }
        const style = analyzeCommitStyle(commits);
        return {
          usesConventionalCommits: style.usesConventionalCommits,
          conventionalPrefixes: style.conventionalPrefixes,
          averageSubjectLength: style.averageSubjectLength,
          guidelines: styleToPromptGuidelines(style),
        };
      },
    }),
  };
}
