import type { Options } from "@truyman/cli";

export const GlobalOptions = {
  verbose: {
    type: "boolean",
    short: "v",
    description: "Enable verbose output",
  },
  cwd: {
    type: "string",
    description: "Set working directory",
  },
} as const satisfies Options;
