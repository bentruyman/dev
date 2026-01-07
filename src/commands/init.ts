import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { command } from "@truyman/cli";
import kleur from "kleur";

import { GlobalOptions } from "../options.ts";

type Template = "node" | "typescript" | "react" | "cli" | "library";

interface TemplateConfig {
  name: string;
  description: string;
  files: Record<string, string>;
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
}

const templates: Record<Template, TemplateConfig> = {
  node: {
    name: "Node.js",
    description: "Basic Node.js project",
    files: {
      "src/index.js": `console.log("Hello, world!");
`,
      ".gitignore": `node_modules/
dist/
.env
`,
    },
    scripts: {
      start: "node src/index.js",
    },
  },
  typescript: {
    name: "TypeScript",
    description: "TypeScript project with strict configuration",
    files: {
      "src/index.ts": `console.log("Hello, TypeScript!");
`,
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            outDir: "dist",
            rootDir: "src",
            declaration: true,
          },
          include: ["src"],
          exclude: ["node_modules", "dist"],
        },
        null,
        2,
      ),
      ".gitignore": `node_modules/
dist/
.env
`,
    },
    devDependencies: ["typescript", "@types/node"],
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "tsc --watch",
    },
  },
  react: {
    name: "React",
    description: "React application with TypeScript",
    files: {
      "src/App.tsx": `export function App() {
  return (
    <div>
      <h1>Hello, React!</h1>
    </div>
  );
}
`,
      "src/index.tsx": `import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`,
      "public/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
`,
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
          },
          include: ["src"],
        },
        null,
        2,
      ),
      ".gitignore": `node_modules/
dist/
.env
`,
    },
    dependencies: ["react", "react-dom"],
    devDependencies: [
      "typescript",
      "@types/react",
      "@types/react-dom",
      "vite",
      "@vitejs/plugin-react",
    ],
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
  },
  cli: {
    name: "CLI Tool",
    description: "Command-line tool with TypeScript",
    files: {
      "src/index.ts": `#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: my-cli [options]");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help     Show help");
  console.log("  -v, --version  Show version");
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log("1.0.0");
  process.exit(0);
}

console.log("Hello from CLI!");
`,
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            outDir: "dist",
            rootDir: "src",
            declaration: true,
          },
          include: ["src"],
          exclude: ["node_modules", "dist"],
        },
        null,
        2,
      ),
      ".gitignore": `node_modules/
dist/
.env
`,
    },
    devDependencies: ["typescript", "@types/node"],
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "tsc --watch",
    },
  },
  library: {
    name: "Library",
    description: "Reusable library with TypeScript",
    files: {
      "src/index.ts": `/**
 * Example function that adds two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Example function that subtracts two numbers
 */
export function subtract(a: number, b: number): number {
  return a - b;
}
`,
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            outDir: "dist",
            rootDir: "src",
            declaration: true,
            declarationMap: true,
            sourceMap: true,
          },
          include: ["src"],
          exclude: ["node_modules", "dist"],
        },
        null,
        2,
      ),
      ".gitignore": `node_modules/
dist/
.env
`,
    },
    devDependencies: ["typescript", "@types/node"],
    scripts: {
      build: "tsc",
      prepublishOnly: "npm run build",
    },
  },
};

function initGit(cwd: string): void {
  try {
    execSync("git init", { cwd, stdio: "pipe" });
    execSync("git add .", { cwd, stdio: "pipe" });
    execSync('git commit -m "Initial commit"', { cwd, stdio: "pipe" });
  } catch {
    // Ignore git errors
  }
}

function installDependencies(cwd: string, pm: string): void {
  try {
    execSync(`${pm} install`, { cwd, stdio: "inherit" });
  } catch {
    console.error(kleur.yellow("Warning: Failed to install dependencies"));
  }
}

export const init = command({
  name: "init",
  description: "Initialize a new project with templates",
  inherits: GlobalOptions,
  args: [
    {
      name: "directory",
      type: "string",
      description: "Directory to initialize (default: current directory)",
    },
  ] as const,
  options: {
    template: {
      type: "string",
      short: "t",
      description: "Template to use: node, typescript, react, cli, library",
    },
    name: {
      type: "string",
      short: "n",
      description: "Project name (default: directory name)",
    },
    git: {
      type: "boolean",
      short: "g",
      description: "Initialize git repository",
    },
    install: {
      type: "boolean",
      short: "i",
      description: "Install dependencies after initialization",
    },
    pm: {
      type: "string",
      description: "Package manager to use: npm, bun, yarn, pnpm (default: npm)",
    },
  },
  handler: async ([directory], options) => {
    const cwd = options.cwd || process.cwd();
    const dirPath = directory ? String(directory) : undefined;
    const targetDir = dirPath ? join(cwd, dirPath) : cwd;
    const projectName = options.name || basename(targetDir);

    // Check if directory exists and is not empty
    if (existsSync(targetDir)) {
      const files = readdirSync(targetDir);
      if (files.length > 0 && files.some((f) => !f.startsWith("."))) {
        console.error(kleur.red(`fatal: directory '${directory || "."}' is not empty`));
        process.exit(1);
      }
    } else if (directory) {
      mkdirSync(targetDir, { recursive: true });
    }

    const templateName = (options.template || "typescript") as Template;
    if (!templates[templateName]) {
      console.error(kleur.red(`fatal: unknown template '${templateName}'`));
      console.error(kleur.dim("Available templates: " + Object.keys(templates).join(", ")));
      process.exit(1);
    }

    const template = templates[templateName];

    console.log(kleur.cyan(`Initializing ${template.name} project...`));

    // Create directories and files
    for (const [filePath, content] of Object.entries(template.files)) {
      const fullPath = join(targetDir, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(fullPath, content);
      if (options.verbose) {
        console.log(kleur.dim(`  Created ${filePath}`));
      }
    }

    // Create package.json
    const packageJson: Record<string, unknown> = {
      name: projectName,
      version: "1.0.0",
      description: "",
      type: "module",
      main: templateName === "node" ? "src/index.js" : "dist/index.js",
      scripts: template.scripts || {},
    };

    if (templateName === "cli") {
      packageJson.bin = { [projectName]: "dist/index.js" };
    }

    if (templateName === "library") {
      packageJson.files = ["dist"];
      packageJson.exports = {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      };
    }

    if (template.dependencies) {
      packageJson.dependencies = Object.fromEntries(template.dependencies.map((d) => [d, "*"]));
    }

    if (template.devDependencies) {
      packageJson.devDependencies = Object.fromEntries(
        template.devDependencies.map((d) => [d, "*"]),
      );
    }

    writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
    if (options.verbose) {
      console.log(kleur.dim("  Created package.json"));
    }

    console.log(kleur.green(`Created ${template.name} project in ${directory || "."}`));

    // Install dependencies
    const pm = options.pm || "npm";
    if (options.install) {
      console.log(kleur.cyan(`\nInstalling dependencies with ${pm}...`));
      installDependencies(targetDir, pm);
    }

    // Initialize git
    if (options.git) {
      console.log(kleur.cyan("\nInitializing git repository..."));
      initGit(targetDir);
      console.log(kleur.green("Git repository initialized"));
    }

    console.log();
    console.log(kleur.bold("Next steps:"));
    if (directory) {
      console.log(kleur.dim(`  cd ${directory}`));
    }
    if (!options.install) {
      console.log(kleur.dim(`  ${pm} install`));
    }
    if (template.scripts?.dev) {
      console.log(kleur.dim(`  ${pm} run dev`));
    } else if (template.scripts?.start) {
      console.log(kleur.dim(`  ${pm} start`));
    }
  },
});
