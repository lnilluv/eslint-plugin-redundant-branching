# Harness Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ready-to-copy integration templates for pi.dev, Claude Code, and opencode that auto-lint TypeScript files with `eslint-plugin-lookup-table` after AI-generated edits.

**Architecture:** Three independent harness config directories under `harness-configs/`, each self-contained with its own files and a shared README. The pi integration is a publishable npm package; Claude Code and opencode are copy-paste config templates.

**Tech Stack:** TypeScript, ESLint 9 flat config, pi extension API, Claude Code hooks, opencode plugin API

---

### Task 1: Claude Code integration

**Files:**
- Create: `harness-configs/claude-code/.claude/settings.json`
- Create: `harness-configs/claude-code/.claude/hooks/lint-lookup.sh`

- [ ] **Step 1: Create the hook shell script**

Create `harness-configs/claude-code/.claude/hooks/lint-lookup.sh`:

```bash
#!/usr/bin/env bash
# lint-lookup.sh — PostToolUse hook for eslint-plugin-lookup-table
# Runs ESLint with the redundant-branching rule on written/edited TS files.
# Always exits 0 — PostToolUse hooks must never block Claude Code.

set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path or not a TypeScript file
if [[ -z "$FILE" || ( "$FILE" != *.ts && "$FILE" != *.tsx ) ]]; then
  exit 0
fi

# Resolve to absolute path from project root
if [[ "$FILE" != /* ]]; then
  FILE="$CLAUDE_PROJECT_DIR/$FILE"
fi

# Run ESLint — output goes to stdout as context for Claude Code
npx eslint --no-error-on-unmatched-pattern --fix "$FILE" 2>&1 || true

exit 0
```

- [ ] **Step 2: Create the settings.json**

Create `harness-configs/claude-code/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/lint-lookup.sh\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Make script executable**

Run: `chmod +x harness-configs/claude-code/.claude/hooks/lint-lookup.sh`

- [ ] **Step 4: Commit**

```bash
git add harness-configs/claude-code/
git commit -m "feat: add Claude Code PostToolUse hook for lookup-table linting"
```

---

### Task 2: opencode plugin

**Files:**
- Create: `harness-configs/opencode/.opencode/plugin/lint-lookup.ts`

- [ ] **Step 1: Create the plugin file**

Create `harness-configs/opencode/.opencode/plugin/lint-lookup.ts`:

```typescript
/**
 * lint-lookup — opencode plugin for eslint-plugin-lookup-table
 *
 * Runs ESLint with the no-redundant-branching rule after every file
 * write or edit on TypeScript files. Diagnostics are logged to the
 * console so opencode can surface them to the model.
 */
import type { Plugin } from "@opencode-ai/plugin";

export const LintLookup: Plugin = async ({ $ }) => {
  return {
    tool: {
      execute: {
        after: async (input, output) => {
          if (input.tool !== "edit" && input.tool !== "write") return;

          const file: string | undefined = output.args?.filePath;
          if (!file || (!file.endsWith(".ts") && !file.endsWith(".tsx"))) return;

          try {
            const result =
              await $`npx eslint --no-error-on-unmatched-pattern --fix ${file} 2>&1`.quiet();
            if (result.exitCode !== 0) {
              console.log(
                `[lint-lookup] eslint-plugin-lookup-table found issues in ${file}:\n${result.stdout}`,
              );
            }
          } catch {
            // Never crash the plugin on lint failure
          }
        },
      },
    },
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add harness-configs/opencode/
git commit -m "feat: add opencode plugin for lookup-table linting"
```

---

### Task 3: pi.dev extension package (pi-lookup-lint)

**Files:**
- Create: `harness-configs/pi/package.json`
- Create: `harness-configs/pi/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `harness-configs/pi/package.json`:

```json
{
  "name": "pi-lookup-lint",
  "version": "0.1.0",
  "description": "Auto-lint redundant branching patterns into lookup tables after every AI edit",
  "type": "module",
  "pi": {
    "extensions": ["./src/index.ts"]
  },
  "peerDependencies": {
    "eslint": ">=9.0.0",
    "eslint-plugin-lookup-table": ">=0.0.1"
  },
  "keywords": ["pi-extension", "eslint", "lookup-table", "lint"],
  "license": "MIT"
}
```

- [ ] **Step 2: Create the extension**

Create `harness-configs/pi/src/index.ts`:

```typescript
/**
 * pi-lookup-lint — pi extension for eslint-plugin-lookup-table
 *
 * Automatically runs the no-redundant-branching ESLint rule after every
 * file write or edit on TypeScript files. Diagnostics are fed back to
 * the LLM so it can fix the violations in the same turn.
 *
 * Install: pi install npm:pi-lookup-lint
 * Requires: eslint-plugin-lookup-table configured in eslint.config.js
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("pi-lookup-lint active — redundant branching patterns will be caught", "info");
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath: string | undefined = event.input?.path;
    if (!filePath || (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx"))) return;

    try {
      const result = await pi.exec("npx", [
        "eslint",
        "--no-error-on-unmatched-pattern",
        "--format",
        "stylish",
        filePath,
      ], { timeout: 15_000 });

      if (result.code !== 0 && result.stdout.trim()) {
        return {
          content: [
            ...event.content,
            {
              type: "text" as const,
              text: `\n\n⚠️ eslint-plugin-lookup-table found redundant branching:\n\n${result.stdout}\n\nFix these by consolidating the repeated conditional chains into a single lookup table.`,
            },
          ],
        };
      }
    } catch {
      // Never block on lint failure
    }
  });

  pi.registerCommand("lint-branching", {
    description: "Scan all TypeScript files for redundant branching patterns",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Scanning for redundant branching patterns…", "info");
      try {
        const result = await pi.exec("npx", [
          "eslint",
          "--no-error-on-unmatched-pattern",
          "--format",
          "stylish",
          "--ext",
          ".ts,.tsx",
          ".",
        ], { timeout: 60_000 });

        if (result.code === 0) {
          ctx.ui.notify("No redundant branching patterns found.", "success");
        } else {
          ctx.ui.notify(
            `Found redundant branching patterns:\n${result.stdout}`,
            "warning",
          );
        }
      } catch (err) {
        ctx.ui.notify(`Lint scan failed: ${err}`, "error");
      }
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add harness-configs/pi/
git commit -m "feat: add pi-lookup-lint extension package"
```

---

### Task 4: Harness configs README

**Files:**
- Create: `harness-configs/README.md`

- [ ] **Step 1: Write the README**

Create `harness-configs/README.md` with:

1. Title and one-line description
2. Prerequisites section (eslint-plugin-lookup-table installed, eslint.config.js configured with the plugin)
3. pi.dev section — install command (`pi install npm:pi-lookup-lint`), what the extension does (auto-lint on write/edit, `/lint-branching` command)
4. Claude Code section — copy `.claude/` directory to project root, prerequisites (`jq` installed), what the hook does
5. opencode section — copy `.opencode/` directory to project root, what the plugin does

Keep each section to 5–10 lines. Use the writing-clearly-and-concisely skill.

- [ ] **Step 2: Commit**

```bash
git add harness-configs/README.md
git commit -m "docs: add harness integrations README"
```

---

### Task 5: Update main project README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add AI Harness Integration section**

Add a new section after the "How AI spreads this pattern" section and before "Architecture". The section should:

1. Title: "AI harness integration"
2. One paragraph explaining the plugin integrates with AI coding agents to catch patterns as they generate code
3. Table listing the three harnesses with a one-line description each
4. Link to `harness-configs/README.md` for setup instructions

Use the writing-clearly-and-concisely skill.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add AI harness integration section to README"
```
