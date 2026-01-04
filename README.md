# bun/cli

A TypeScript CLI template using Bun.

## Getting Started

```bash
npx giget gh:bentruyman/templates/bun/cli my-cli
cd my-cli
bun install
```

## Customize

Update `package.json` with your project details:

- `name` - Your CLI package name
- `description` - What your CLI does
- `bin` - Rename the command users will type

## Scripts

| Script              | Description                             |
| ------------------- | --------------------------------------- |
| `bun run build`     | Bundle for Node.js (outputs to `dist/`) |
| `bun run format`    | Format code with oxfmt                  |
| `bun run typecheck` | Type-check with TypeScript              |
| `bun run release`   | Publish a new version with release-it   |

## Development

Run your CLI locally:

```bash
bun run src/index.ts --help
```

## Publishing

1. Update `package.json` name and bin fields
2. Run `bun run release` to build, tag, and publish to npm
