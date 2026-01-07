import { command, run } from "@truyman/cli";

import pkg from "../package.json";
import { changelog, commit, deps, docs, explain, init, pr, review } from "./commands/index.ts";
import { GlobalOptions } from "./options.ts";

const dev = command({
  name: "dev",
  description: pkg.description,
  version: pkg.version,
  options: GlobalOptions,
  subcommands: [changelog, commit, deps, docs, explain, init, pr, review],
});

run(dev, process.argv.slice(2));
