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
  execSync("git commit -F -", {
    cwd,
    input: message,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return exec("git rev-parse HEAD", cwd);
}

export function getCurrentBranch(cwd?: string): string {
  return exec("git branch --show-current", cwd);
}

export function getDefaultBranch(cwd?: string): string {
  try {
    const remoteBranch = exec("git symbolic-ref refs/remotes/origin/HEAD", cwd);
    return remoteBranch.replace("refs/remotes/origin/", "");
  } catch {
    const branches = exec("git branch -l main master", cwd);
    if (branches.includes("main")) return "main";
    if (branches.includes("master")) return "master";
    return "main";
  }
}

export function getCommitsBetween(base: string, head: string = "HEAD", cwd?: string): CommitInfo[] {
  try {
    const output = exec(`git log ${base}..${head} --format="%H%x00%s%x00%b%x00"`, cwd);
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

export function getDiffBetween(base: string, head: string = "HEAD", cwd?: string): string {
  try {
    return exec(`git diff ${base}...${head}`, cwd);
  } catch {
    return "";
  }
}

export function getFilesChangedBetween(
  base: string,
  head: string = "HEAD",
  cwd?: string,
): StagedFile[] {
  try {
    const output = exec(`git diff --name-status ${base}...${head}`, cwd);
    if (!output) return [];

    return output.split("\n").map((line) => {
      const [status = "", ...fileParts] = line.split("\t");
      return { status, file: fileParts.join("\t") };
    });
  } catch {
    return [];
  }
}

export function hasUnpushedCommits(base: string, cwd?: string): boolean {
  try {
    const output = exec(`git log origin/${base}..HEAD --oneline`, cwd);
    return output.length > 0;
  } catch {
    return true;
  }
}

export function getLatestTag(cwd?: string): string | null {
  try {
    return exec("git describe --tags --abbrev=0", cwd);
  } catch {
    return null;
  }
}

export function getAllTags(cwd?: string): string[] {
  try {
    const output = exec("git tag --sort=-version:refname", cwd);
    if (!output) return [];
    return output.split("\n").filter((tag) => tag.trim());
  } catch {
    return [];
  }
}

export function getCommitsSinceTag(tag: string, cwd?: string): CommitInfo[] {
  return getCommitsBetween(tag, "HEAD", cwd);
}

export function getFirstCommit(cwd?: string): string | null {
  try {
    return exec("git rev-list --max-parents=0 HEAD", cwd);
  } catch {
    return null;
  }
}

export function getCommitDetails(
  sha: string,
  cwd?: string,
): { info: CommitInfo; diff: string } | null {
  try {
    const output = exec(`git log -1 --format="%H%x00%s%x00%b" ${sha}`, cwd);
    const [hash = "", subject = "", body = ""] = output.split("\x00");
    const diff = exec(`git show ${sha} --format="" --patch`, cwd);
    return {
      info: { hash, subject, body: body.trim() },
      diff,
    };
  } catch {
    return null;
  }
}

export function isHeadPushed(cwd?: string): boolean {
  try {
    const branch = getCurrentBranch(cwd);
    if (!branch) return false;
    const local = exec("git rev-parse HEAD", cwd);
    const remote = exec(`git rev-parse origin/${branch}`, cwd);
    return local === remote;
  } catch {
    return false;
  }
}

export function getLastCommit(cwd?: string): CommitInfo | null {
  const commits = getRecentCommits(1, cwd);
  return commits[0] ?? null;
}

export function amendCommit(message: string, cwd?: string): string {
  execSync("git commit --amend -F -", {
    cwd,
    input: message,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return exec("git rev-parse HEAD", cwd);
}

export function getCombinedDiff(cwd?: string): string {
  const stagedDiff = getStagedDiff(cwd);
  const lastCommitDiff = exec('git show HEAD --format="" --patch', cwd);
  return `${lastCommitDiff}\n\n${stagedDiff}`;
}

export function getCombinedFiles(cwd?: string): StagedFile[] {
  const stagedFiles = getStagedFiles(cwd);
  const lastCommitFiles = exec('git show HEAD --format="" --name-status', cwd);

  const filesMap = new Map<string, StagedFile>();

  if (lastCommitFiles) {
    lastCommitFiles.split("\n").forEach((line) => {
      const [status = "", ...fileParts] = line.split("\t");
      const file = fileParts.join("\t");
      if (file) filesMap.set(file, { status, file });
    });
  }

  stagedFiles.forEach((f) => {
    filesMap.set(f.file, f);
  });

  return Array.from(filesMap.values());
}
