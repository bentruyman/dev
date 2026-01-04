import { execSync } from "node:child_process";

export interface CommitInfo {
  hash: string;
  subject: string;
  body: string;
}

export interface StagedFile {
  status: string;
  file: string;
}

function exec(command: string, cwd?: string): string {
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function isGitRepository(cwd?: string): boolean {
  try {
    exec("git rev-parse --is-inside-work-tree", cwd);
    return true;
  } catch {
    return false;
  }
}

export function getStagedDiff(cwd?: string): string {
  return exec("git diff --cached", cwd);
}

export function getStagedFiles(cwd?: string): StagedFile[] {
  const output = exec("git diff --cached --name-status", cwd);
  if (!output) return [];

  return output.split("\n").map((line) => {
    const [status = "", ...fileParts] = line.split("\t");
    return { status, file: fileParts.join("\t") };
  });
}

export function getRecentCommits(count: number = 10, cwd?: string): CommitInfo[] {
  try {
    const output = exec(`git log -n ${count} --format="%H%x00%s%x00%b%x00"`, cwd);
    if (!output) return [];

    return output
      .split("\x00\n")
      .filter((entry) => entry.trim())
      .map((entry) => {
        const [hash = "", subject = "", body = ""] = entry.split("\x00");
        return { hash, subject, body: body.trim() };
      });
  } catch {
    return [];
  }
}

export function stageAllChanges(cwd?: string): void {
  exec("git add -u", cwd);
}

export function createCommit(message: string, cwd?: string): string {
  exec(`git commit -m ${JSON.stringify(message)}`, cwd);
  return exec("git rev-parse HEAD", cwd);
}

export function getCurrentBranch(cwd?: string): string {
  return exec("git branch --show-current", cwd);
}
