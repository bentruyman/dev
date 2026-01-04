import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface EditorResult {
  message: string;
  aborted: boolean;
}

function getEditor(): string {
  if (process.env.VISUAL) return process.env.VISUAL;
  if (process.env.EDITOR) return process.env.EDITOR;
  if (existsSync("/usr/bin/vim")) return "vim";
  if (existsSync("/usr/bin/vi")) return "vi";
  return "nano";
}

function formatMessageForEditor(message: string, branch: string): string {
  const lines = [
    message,
    "",
    "# Please enter the commit message for your changes. Lines starting",
    "# with '#' will be ignored, and an empty message aborts the commit.",
    "#",
    `# On branch ${branch}`,
    "#",
  ];
  return lines.join("\n");
}

function parseEditedMessage(content: string): string {
  return content
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim();
}

export function openInEditor(initialMessage: string, branch: string): EditorResult {
  const tmpDir = mkdtempSync(join(tmpdir(), "dev-commit-"));
  const tmpFile = join(tmpDir, "COMMIT_EDITMSG");

  try {
    writeFileSync(tmpFile, formatMessageForEditor(initialMessage, branch), "utf-8");

    const editor = getEditor();
    const result = spawnSync(editor, [tmpFile], {
      stdio: "inherit",
      shell: true,
    });

    if (result.status !== 0) {
      return { message: "", aborted: true };
    }

    const editedContent = readFileSync(tmpFile, "utf-8");
    const finalMessage = parseEditedMessage(editedContent);

    return {
      message: finalMessage,
      aborted: finalMessage.length === 0,
    };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
