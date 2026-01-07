import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { command } from "@truyman/cli";
import kleur from "kleur";

import { GlobalOptions } from "../options.ts";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface OutdatedInfo {
  current: string;
  wanted: string;
  latest: string;
  type: "dependencies" | "devDependencies" | "peerDependencies";
}

function getPackageManager(cwd: string): "npm" | "bun" | "yarn" | "pnpm" {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  return "npm";
}

function checkOutdated(cwd: string, pm: string): Record<string, OutdatedInfo> {
  try {
    let output: string;

    switch (pm) {
      case "bun":
        // Bun doesn't have a built-in outdated command, use npm
        output = execSync("npm outdated --json", {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        break;
      case "yarn":
        output = execSync("yarn outdated --json", {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        break;
      case "pnpm":
        output = execSync("pnpm outdated --format json", {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        break;
      default:
        output = execSync("npm outdated --json", {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
    }

    if (!output.trim()) return {};
    return JSON.parse(output);
  } catch (error: unknown) {
    // npm outdated returns exit code 1 when there are outdated packages
    if (error && typeof error === "object" && "stdout" in error) {
      const stdout = (error as { stdout: string }).stdout;
      if (stdout) {
        try {
          return JSON.parse(stdout);
        } catch {
          return {};
        }
      }
    }
    return {};
  }
}

function runSecurityAudit(cwd: string, pm: string): { vulnerabilities: number; details: string } {
  try {
    let cmd: string;
    switch (pm) {
      case "bun":
        cmd = "npm audit --json";
        break;
      case "yarn":
        cmd = "yarn audit --json";
        break;
      case "pnpm":
        cmd = "pnpm audit --json";
        break;
      default:
        cmd = "npm audit --json";
    }

    const output = execSync(cmd, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const data = JSON.parse(output);
    const vulnCount = data.metadata?.vulnerabilities?.total || 0;
    return { vulnerabilities: vulnCount, details: output };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stdout" in error) {
      const stdout = (error as { stdout: string }).stdout;
      if (stdout) {
        try {
          const data = JSON.parse(stdout);
          const vulnCount =
            data.metadata?.vulnerabilities?.total ||
            Object.values(data.metadata?.vulnerabilities || {}).reduce(
              (a: number, b: unknown) => a + (b as number),
              0,
            );
          return { vulnerabilities: vulnCount, details: stdout };
        } catch {
          return { vulnerabilities: 0, details: "" };
        }
      }
    }
    return { vulnerabilities: 0, details: "" };
  }
}

export const deps = command({
  name: "deps",
  description: "Analyze and manage project dependencies",
  inherits: GlobalOptions,
  args: [] as const,
  options: {
    check: {
      type: "boolean",
      short: "c",
      description: "Check for outdated dependencies (default)",
    },
    security: {
      type: "boolean",
      short: "s",
      description: "Run security audit",
    },
    major: {
      type: "boolean",
      short: "M",
      description: "Include major version updates in check",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  handler: async ([], options) => {
    const cwd = options.cwd || process.cwd();
    const packageJsonPath = join(cwd, "package.json");

    if (!existsSync(packageJsonPath)) {
      console.error(kleur.red("fatal: no package.json found"));
      process.exit(1);
    }

    const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const pm = getPackageManager(cwd);

    if (options.verbose) {
      console.log(kleur.dim(`Detected package manager: ${pm}`));
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const depCount = Object.keys(allDeps).length;
    console.log(kleur.cyan(`Analyzing ${depCount} dependencies...`));

    if (options.security) {
      console.log();
      console.log(kleur.bold("Security Audit"));
      console.log(kleur.dim("─".repeat(40)));

      const audit = runSecurityAudit(cwd, pm);

      if (options.json) {
        console.log(audit.details);
      } else if (audit.vulnerabilities === 0) {
        console.log(kleur.green("No vulnerabilities found"));
      } else {
        console.log(kleur.red(`Found ${audit.vulnerabilities} vulnerability(ies)`));
        console.log(kleur.dim(`Run '${pm} audit' for details`));
      }

      if (!options.check) return;
    }

    console.log();
    console.log(kleur.bold("Outdated Dependencies"));
    console.log(kleur.dim("─".repeat(40)));

    const outdated = checkOutdated(cwd, pm);
    const outdatedEntries = Object.entries(outdated);

    if (options.json) {
      console.log(JSON.stringify(outdated, null, 2));
      return;
    }

    if (outdatedEntries.length === 0) {
      console.log(kleur.green("All dependencies are up to date"));
      return;
    }

    const updates: {
      pkg: string;
      current: string;
      wanted: string;
      latest: string;
      isMajor: boolean;
    }[] = [];

    for (const [pkg, info] of outdatedEntries) {
      const current = info.current || "?";
      const wanted = info.wanted || current;
      const latest = info.latest || wanted;

      const currentMajor = current.split(".")[0];
      const latestMajor = latest.split(".")[0];
      const isMajor = currentMajor !== latestMajor;

      if (!options.major && isMajor && wanted === current) {
        continue;
      }

      updates.push({ pkg, current, wanted, latest, isMajor });
    }

    if (updates.length === 0) {
      console.log(kleur.green("All dependencies are up to date (excluding major updates)"));
      console.log(kleur.dim("Use --major to see major version updates"));
      return;
    }

    // Sort: minor/patch first, then major
    updates.sort((a, b) => {
      if (a.isMajor !== b.isMajor) return a.isMajor ? 1 : -1;
      return a.pkg.localeCompare(b.pkg);
    });

    const minorUpdates = updates.filter((u) => !u.isMajor);
    const majorUpdates = updates.filter((u) => u.isMajor);

    if (minorUpdates.length > 0) {
      console.log(kleur.yellow(`\nMinor/Patch Updates (${minorUpdates.length}):`));
      for (const { pkg, current, wanted } of minorUpdates) {
        console.log(`  ${pkg}: ${kleur.dim(current)} → ${kleur.green(wanted)}`);
      }
    }

    if (majorUpdates.length > 0 && options.major) {
      console.log(kleur.red(`\nMajor Updates (${majorUpdates.length}):`));
      for (const { pkg, current, latest } of majorUpdates) {
        console.log(`  ${pkg}: ${kleur.dim(current)} → ${kleur.red(latest)}`);
      }
    } else if (majorUpdates.length > 0) {
      console.log(
        kleur.dim(`\n${majorUpdates.length} major update(s) available. Use --major to see them.`),
      );
    }

    console.log();
    console.log(kleur.dim(`Run '${pm} update' to update minor/patch versions`));
  },
});
