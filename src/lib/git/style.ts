import type { CommitInfo } from "./index.ts";

export interface CommitStyle {
  usesConventionalCommits: boolean;
  conventionalPrefixes: string[];
  averageSubjectLength: number;
  usesCapitalizedSubject: boolean;
  endsWithPeriod: boolean;
  includesBody: boolean;
  examples: string[];
}

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\(.+\))?!?:/i;

export function analyzeCommitStyle(commits: CommitInfo[]): CommitStyle {
  if (commits.length === 0) {
    return {
      usesConventionalCommits: false,
      conventionalPrefixes: [],
      averageSubjectLength: 50,
      usesCapitalizedSubject: true,
      endsWithPeriod: false,
      includesBody: false,
      examples: [],
    };
  }

  const subjects = commits.map((c) => c.subject);
  const conventionalMatches = subjects.filter((s) => CONVENTIONAL_COMMIT_REGEX.test(s));
  const prefixes = new Set<string>();

  for (const subject of conventionalMatches) {
    const match = subject.match(CONVENTIONAL_COMMIT_REGEX);
    if (match?.[1]) {
      prefixes.add(match[1].toLowerCase());
    }
  }

  const totalLength = subjects.reduce((sum, s) => sum + s.length, 0);
  const capitalizedCount = subjects.filter((s) => s.length > 0 && /^[A-Z]/.test(s)).length;
  const periodCount = subjects.filter((s) => s.endsWith(".")).length;
  const bodyCount = commits.filter((c) => c.body.length > 0).length;

  return {
    usesConventionalCommits: conventionalMatches.length > commits.length / 2,
    conventionalPrefixes: Array.from(prefixes),
    averageSubjectLength: Math.round(totalLength / subjects.length),
    usesCapitalizedSubject: capitalizedCount > commits.length / 2,
    endsWithPeriod: periodCount > commits.length / 2,
    includesBody: bodyCount > commits.length / 3,
    examples: subjects.slice(0, 5),
  };
}

export function styleToPromptGuidelines(style: CommitStyle): string {
  const guidelines: string[] = [];

  if (style.usesConventionalCommits) {
    guidelines.push(
      `Use conventional commit format with prefixes like: ${style.conventionalPrefixes.join(", ")}`,
    );
  }

  guidelines.push(`Keep subject lines around ${style.averageSubjectLength} characters`);

  if (style.usesCapitalizedSubject) {
    guidelines.push("Start the subject with a capital letter");
  } else {
    guidelines.push("Start the subject with a lowercase letter");
  }

  if (style.endsWithPeriod) {
    guidelines.push("End the subject with a period");
  } else {
    guidelines.push("Do not end the subject with a period");
  }

  if (style.includesBody) {
    guidelines.push("Include a body for complex changes");
  }

  if (style.examples.length > 0) {
    guidelines.push(
      `\nExample commits from this repository:\n${style.examples.map((e) => `- ${e}`).join("\n")}`,
    );
  }

  return guidelines.join("\n");
}
