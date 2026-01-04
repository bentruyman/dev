import type { Options } from "@truyman/cli";

export const GlobalOptions = {
  verbose: {
    type: "boolean",
    short: "v",
    description: "Enable verbose output",
  },
  quiet: {
    type: "boolean",
    short: "q",
    description: "Suppress non-essential output",
  },
  cwd: {
    type: "string",
    description: "Set working directory",
  },
} as const satisfies Options;
