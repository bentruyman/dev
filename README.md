# @truyman/dev

A CLI for common developer daily tasks.

## Installation

```bash
npm install -g @truyman/dev
```

## Commands

### `dev commit`

Generate an AI-powered commit message for staged changes. Analyzes your recent commits to match your commit style.

```bash
# Generate message and open editor to review
dev commit

# Stage all modified files and commit
dev commit -a

# Provide context for the AI
dev commit -m "This fixes the login timeout bug"

# Preview without committing
dev commit --dry-run

# Skip editor, commit directly
dev commit --no-edit
```

**Options:**

| Flag            | Description                                        |
| --------------- | -------------------------------------------------- |
| `-a, --all`     | Stage all modified/deleted files before committing |
| `-m, --message` | Additional context for the AI                      |
| `-n, --dry-run` | Print message without committing                   |
| `--no-edit`     | Skip editor, commit directly                       |
| `--provider`    | AI provider (`anthropic`, `openai`)                |
| `--model`       | Specific model to use                              |

## Configuration

Set these environment variables:

| Variable            | Description                | Default                     |
| ------------------- | -------------------------- | --------------------------- |
| `ANTHROPIC_API_KEY` | Anthropic API key          | Required if using Anthropic |
| `DEV_AI_MODEL`      | Override the default model | Provider default            |
| `DEV_AI_PROVIDER`   | AI provider to use         | `anthropic`                 |
| `OPENAI_API_KEY`    | OpenAI API key             | Required if using OpenAI    |
