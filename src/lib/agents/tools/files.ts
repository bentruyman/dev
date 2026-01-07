import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, dirname, extname } from "node:path";
import { tool } from "ai";
import { z } from "zod";

export function createFileTools(cwd?: string) {
  const basePath = cwd || process.cwd();

  return {
    readFile: tool({
      description: "Read the contents of a file",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the file from project root"),
      }),
      execute: async ({ path }) => {
        const fullPath = resolve(basePath, path);

        // Security: prevent reading outside project
        if (!fullPath.startsWith(basePath)) {
          return "Error: Cannot read files outside the project directory.";
        }

        if (!existsSync(fullPath)) {
          return `Error: File not found: ${path}`;
        }

        try {
          const content = readFileSync(fullPath, "utf-8");
          // Truncate large files
          if (content.length > 100000) {
            return content.slice(0, 100000) + "\n... (file truncated due to size)";
          }
          return content;
        } catch (error) {
          return `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    }),

    listFiles: tool({
      description: "List files in a directory",
      inputSchema: z.object({
        path: z.string().optional().describe("Relative path to directory (default: project root)"),
        pattern: z.string().optional().describe("Filter by file extension (e.g., '.ts', '.js')"),
      }),
      execute: async ({ path, pattern }) => {
        const targetPath = path ? resolve(basePath, path) : basePath;

        if (!targetPath.startsWith(basePath)) {
          return "Error: Cannot list files outside the project directory.";
        }

        if (!existsSync(targetPath)) {
          return `Error: Directory not found: ${path || "."}`;
        }

        try {
          const entries = readdirSync(targetPath, { withFileTypes: true });
          const result = entries
            .filter((entry) => {
              if (entry.name.startsWith(".")) return false;
              if (entry.name === "node_modules") return false;
              if (pattern && entry.isFile() && !entry.name.endsWith(pattern)) return false;
              return true;
            })
            .map((entry) => ({
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
            }));

          return result.length > 0 ? result : "No files found matching criteria.";
        } catch (error) {
          return `Error listing directory: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    }),

    findFiles: tool({
      description: "Recursively find files matching a pattern",
      inputSchema: z.object({
        pattern: z.string().describe("File extension to search for (e.g., '.ts', '.test.ts')"),
        directory: z.string().optional().describe("Directory to search in (default: src/)"),
        maxResults: z.number().optional().describe("Maximum number of results (default: 50)"),
      }),
      execute: async ({ pattern, directory, maxResults }) => {
        const searchDir = directory ? resolve(basePath, directory) : resolve(basePath, "src");
        const max = maxResults || 50;
        const results: string[] = [];

        function searchRecursive(dir: string) {
          if (results.length >= max) return;
          if (!existsSync(dir)) return;

          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= max) break;
              if (
                entry.name.startsWith(".") ||
                entry.name === "node_modules" ||
                entry.name === "dist"
              ) {
                continue;
              }

              const fullPath = join(dir, entry.name);
              if (entry.isDirectory()) {
                searchRecursive(fullPath);
              } else if (entry.name.endsWith(pattern)) {
                results.push(fullPath.replace(basePath + "/", ""));
              }
            }
          } catch {
            // Ignore permission errors
          }
        }

        searchRecursive(searchDir);
        return results.length > 0 ? results : `No files found matching pattern: ${pattern}`;
      },
    }),

    fileExists: tool({
      description: "Check if a file or directory exists",
      inputSchema: z.object({
        path: z.string().describe("Relative path to check"),
      }),
      execute: async ({ path }) => {
        const fullPath = resolve(basePath, path);
        if (!fullPath.startsWith(basePath)) {
          return { exists: false, error: "Path outside project directory" };
        }

        const exists = existsSync(fullPath);
        if (!exists) {
          return { exists: false };
        }

        const stats = statSync(fullPath);
        return {
          exists: true,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.size,
        };
      },
    }),

    getFileInfo: tool({
      description: "Get information about a file (extension, directory, etc.)",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the file"),
      }),
      execute: async ({ path }) => {
        return {
          basename: basename(path),
          dirname: dirname(path),
          extension: extname(path),
          fullPath: path,
        };
      },
    }),
  };
}
