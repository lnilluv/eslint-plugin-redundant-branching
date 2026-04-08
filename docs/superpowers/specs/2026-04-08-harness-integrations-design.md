# AI Harness Integrations for eslint-plugin-lookup-table

## Goal

Ship ready-to-copy configuration templates that integrate the `eslint-plugin-lookup-table` ESLint rule into three AI coding harnesses: pi.dev, Claude Code, and opencode. Each template auto-lints TypeScript files after the AI writes or edits them and feeds diagnostics back to the model.

## Targets

| Harness | Mechanism | Integration depth |
|---------|-----------|-------------------|
| **pi.dev** | Publishable pi extension package (`pi-lookup-lint`) | Full: `tool_result` hook, `/lint-branching` command, session notification |
| **Claude Code** | `PostToolUse` hook in `.claude/settings.json` | Shell hook: extracts file path via `jq`, runs `eslint --fix` on `.ts`/`.tsx` |
| **opencode** | Plugin in `.opencode/plugin/` | TypeScript plugin: `tool.execute.after` hook runs eslint on edited files |

## Directory Layout

```
harness-configs/
├── README.md                              # Overview with setup instructions per harness
├── pi/
│   ├── package.json                       # name: pi-lookup-lint, pi.extensions entry
│   └── src/
│       └── index.ts                       # pi extension
├── claude-code/
│   └── .claude/
│       ├── settings.json                  # PostToolUse hook config
│       └── hooks/
│           └── lint-lookup.sh             # Shell script run by the hook
└── opencode/
    └── .opencode/
        └── plugin/
            └── lint-lookup.ts             # opencode plugin
```

## pi-lookup-lint (pi.dev package)

### Extension behavior

1. **`session_start`**: Notify that the extension is active (`ctx.ui.notify`).
2. **`tool_result`**: After `write` or `edit` tool completes on a `.ts` or `.tsx` file, run `npx eslint --rule '{"redundant-branching/no-redundant-branching": "error"}' --fix <file>` via `pi.exec`. If violations found, return modified `content` with diagnostic text so the LLM sees the errors and can fix them.
3. **`/lint-branching` command**: Manually run ESLint with the plugin across all `.ts`/`.tsx` in the project. Display results via `ctx.ui.notify`.

### Package metadata

- `name`: `pi-lookup-lint`
- `pi.extensions`: `["./src/index.ts"]`
- Peer dependency: `eslint-plugin-lookup-table` (the renamed plugin)
- No npm dependencies beyond what pi provides

### Best practices followed

- Uses `isBashToolResult` / `isToolCallEventType` type guards where applicable
- Checks `event.toolName` for `write` and `edit` only
- Extracts file path from `event.input.path` (for write/edit tools)
- Never blocks on failure (`exit 0` equivalent — returns original result on error)
- Uses `pi.exec` for shell commands, not raw child_process

## Claude Code (PostToolUse hook)

### Hook configuration (`.claude/settings.json`)

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

### Shell script (`lint-lookup.sh`)

1. Read JSON from stdin
2. Extract `file_path` via `jq -r '.tool_input.file_path'`
3. Check if file ends in `.ts` or `.tsx` — exit 0 if not
4. Run `npx eslint --fix "$FILE"` (project's eslint.config.js must include the plugin)
5. If eslint reports errors, output them to stdout (Claude Code uses this as feedback context)
6. Always `exit 0` — never block Claude Code

### Best practices followed

- Uses `$CLAUDE_PROJECT_DIR` for repo-root resolution
- `exit 0` on all paths — PostToolUse hooks should never block
- `timeout: 30` to prevent hangs
- Script is executable (`chmod +x`)
- `jq` dependency documented in README
- Matches `Write|Edit` — the two tools that modify files

## opencode (plugin)

### Plugin file (`.opencode/plugin/lint-lookup.ts`)

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const LintLookup: Plugin = async ({ $ }) => {
  return {
    tool: {
      execute: {
        after: async (input, output) => {
          if (input.tool === "edit" || input.tool === "write") {
            const file = output.args.filePath
            if (file && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
              const result = await $`npx eslint --fix ${file} 2>&1`.quiet()
              if (result.exitCode !== 0) {
                console.log(`eslint-plugin-lookup-table: found issues in ${file}`)
                console.log(result.stdout)
              }
            }
          }
        }
      }
    }
  }
}
```

### Best practices followed

- Uses `$` shell helper (idiomatic opencode plugin pattern)
- `.quiet()` to suppress shell noise
- Only hooks `edit` and `write` tools
- Checks file extension before running
- Logs diagnostics to console (opencode surfaces this to the model)
- No thrown errors — failures are logged, not fatal

## README structure

The `harness-configs/README.md` contains:

1. **Overview** — what this directory provides
2. **Prerequisites** — `eslint-plugin-lookup-table` installed, `eslint.config.js` configured
3. **pi.dev** — install command, what it does, link to pi/
4. **Claude Code** — copy instructions, prerequisites (`jq`), link to claude-code/
5. **opencode** — copy instructions, link to opencode/

## What this does NOT include

- No repo rename (separate task)
- No npm publish of `pi-lookup-lint` (user publishes when ready)
- No test harness for the integrations (each is a config template, not testable in isolation)
- No changes to the core ESLint plugin source code
