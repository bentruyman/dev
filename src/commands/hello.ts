import { command } from "@truyman/cli";

import { GlobalOptions } from "../options.ts";

export const hello = command({
  name: "hello",
  description: "A placeholder command to demonstrate the subcommand pattern",
  inherits: GlobalOptions,
  args: [{ name: "name", type: "string", description: "Name to greet", required: false }] as const,
  options: {
    shout: {
      type: "boolean",
      short: "s",
      description: "Shout the greeting",
    },
  },
  handler: ([name], { verbose, shout }) => {
    const target = name ?? "world";
    const greeting = `Hello, ${target}!`;
    const output = shout ? greeting.toUpperCase() : greeting;

    if (verbose) {
      console.log(`Greeting ${target}...`);
    }

    console.log(output);
  },
});
