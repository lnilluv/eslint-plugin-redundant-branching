# AI Harness Integrations

These are ready-to-copy configurations that run eslint-plugin-lookup-table automatically when an AI agent writes TypeScript.

## Prerequisites

- Install `eslint-plugin-lookup-table` as a dev dependency.
- Configure `eslint.config.js` with the plugin:
```javascript
// eslint.config.js
import lookupTable from "eslint-plugin-lookup-table";

export default [lookupTable.configs.recommended];
```

## pi.dev

- Install the extension (bundled — no separate package needed):
```bash
pi install npm:eslint-plugin-lookup-table
```
- It runs the no-redundant-branching rule after every write/edit operation.
- It feeds diagnostics back to the LLM in the same session.
- It adds `/lint-branching` for manual scans.

## Claude Code

- Copy `harness-configs/claude-code/.claude/` to your project root as `.claude/`.
- Install `jq` before using the hook:
  - `brew install jq`
  - `apt-get install jq`
- The PostToolUse hook runs ESLint with `--fix` after every Write/Edit on `.ts` and `.tsx` files.

## opencode

- Copy `harness-configs/opencode/.opencode/` to your project root as `.opencode/`.
- The plugin runs ESLint after every write/edit operation.
- It logs diagnostics so the model can react during generation.
