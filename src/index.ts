import { command, run } from "@truyman/cli";

import pkg from "../package.json";
import { hello } from "./commands/index.ts";
import { GlobalOptions } from "./options.ts";

const dev = command({
  name: "dev",
  description: pkg.description,
  version: pkg.version,
  options: GlobalOptions,
  subcommands: [hello],
});

run(dev, process.argv.slice(2));
