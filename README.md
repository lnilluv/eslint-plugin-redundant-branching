# eslint-plugin-lookup-table

[![npm version](https://img.shields.io/npm/v/eslint-plugin-lookup-table.svg)](https://www.npmjs.com/package/eslint-plugin-lookup-table)
[![license](https://img.shields.io/npm/l/eslint-plugin-lookup-table.svg)](LICENSE)

Finds repeated branching on the same discriminant and, when safe, autofixes it into a lookup table.

## Why

Code that branches on the same discriminant more than once scatters related data across separate conditionals. Adding a new case means updating each branch. Miss one and the behavior drifts.

This rule targets a narrow failure mode in AI-assisted coding: incremental copy-paste edits that add another branch instead of collapsing repeated branching into a lookup table.

## Before

```typescript
const label =
  status === "loading" ? "Loading..."
  : status === "error" ? "Something went wrong"
  : status === "success" ? "Done"
  : "Unknown";

const icon =
  status === "loading" ? "⏳"
  : status === "error" ? "❌"
  : status === "success" ? "✅"
  : "❓";

const color =
  status === "loading" ? "blue"
  : status === "error" ? "red"
  : status === "success" ? "green"
  : "gray";
```

## After (auto-fixed)

```typescript
const _status_LOOKUP = {
  "loading": { label: "Loading...", icon: "⏳", color: "blue" },
  "error":   { label: "Something went wrong", icon: "❌", color: "red" },
  "success": { label: "Done", icon: "✅", color: "green" },
};
const _status_DEFAULT = { label: "Unknown", icon: "❓", color: "gray" };
const { label, icon, color } = _status_LOOKUP[status] ?? _status_DEFAULT;
```

One row per case. One place to edit.

---

## Install

```bash
npm install --save-dev eslint-plugin-lookup-table
```

Requires ESLint 9+ (flat config).

## Setup

```javascript
// eslint.config.js
import lookupTable from "eslint-plugin-lookup-table";

export default [
  {
    plugins: { "lookup-table": lookupTable },
    rules: { "lookup-table/no-redundant-branching": "error" },
  },
];
```

Or use the recommended config:

```javascript
import lookupTable from "eslint-plugin-lookup-table";
export default [lookupTable.configs.recommended];
```

---

## What it detects

The rule finds 2+ conditional structures in the same scope that branch on the same variable with the same set of values.

### Detected forms

| Form | Example |
|------|---------|
| Ternary chains | `x === "a" ? 1 : x === "b" ? 2 : 3` |
| If-else chains | `if (x === "a") ... else if (x === "b") ...` |
| Switch statements | `switch (x) { case "a": ... case "b": ... }` |
| Early-return blocks | `if (x === "a") return {...}; if (x === "b") return {...};` |
| Mixed forms | A ternary and a switch on the same discriminant |

### Not detected

- Different discriminants (`theme` vs `mode`) — intentional
- Different branch sets (`a,b` vs `a,c`) — different structures
- Single chains below threshold — nothing to consolidate
- Chains in different scopes — cannot share a lookup table

---

## Options

```javascript
"lookup-table/no-redundant-branching": ["error", {
  threshold: 2,                  // chains needed to trigger (default: 2)
  includeSwitchStatements: true, // detect switch statements (default: true)
  includeIfElseChains: true,     // detect if-else and early-return (default: true)
  ignoreDiscriminants: ["theme"] // suppress specific discriminants
}]
```

---

## Autofix safety

The autofix runs only when the transformation is safe:

| Condition | Behavior |
|-----------|----------|
| `const` declarations, contiguous, no side effects | Autofixes to lookup table |
| Side effects in branches | Reports only |
| Non-contiguous chains (code between them) | Reports only |
| Non-const declarations | Reports only |
| Early-return blocks | Reports only |

---

## AI-assisted edits

This rule catches a narrow failure mode in AI-assisted coding: incremental copy-paste changes that add another branch instead of collapsing repeated branching into a lookup table. It does not address every kind of AI-generated bug.

The extension runs local ESLint logic. It does not call an external service, make a separate model request, or send code to another API. It adds a small local lint step, so expect a bit of CPU use and some extra latency after edits. In pi.dev, a short diagnostic can be fed back into the same session when the rule finds an issue.

---

## AI harness integration

These configs run the rule after edits so you can catch redundant branching during the session, not just in CI.

### pi.dev

Bundled — no separate package needed.

```bash
pi install npm:eslint-plugin-lookup-table
```

The extension runs local ESLint after write/edit events on TypeScript and JavaScript files. If it finds a violation, it can surface a short diagnostic back into the same session. It also registers a `/lint-branching` command for manual scans.

### Claude Code

Copy `.claude/` from `harness-configs/claude-code/` into your project root. The PostToolUse hook runs local ESLint after writes and edits on `.ts` and `.tsx` files.

### opencode

Copy `.opencode/` from `harness-configs/opencode/` into your project root. The plugin runs local ESLint after writes and edits on TypeScript files and logs diagnostics for the session.

---

## Architecture

```
src/
├── index.ts                       # Plugin entry
├── pi-extension.ts                # pi.dev extension (auto-lint on write/edit)
├── rules/
│   └── no-redundant-branching.ts  # Rule: collect → group → report → fix
└── utils/
    ├── types.ts                   # ChainDescriptor, Branch, etc.
    ├── discriminant.ts            # Extract discriminant from === comparisons
    ├── chain-extractor.ts         # Parse ternary, if-else, switch, early-return
    ├── normalizer.ts              # Group chains by discriminant + structure
    └── autofix.ts                 # Generate lookup table replacement code
```

---

## Contributing

```bash
git clone https://github.com/lnilluv/eslint-plugin-lookup-table.git
cd eslint-plugin-lookup-table
npm install
npm test        # 32 tests
npm run typecheck
npm run build
```

---

## License

MIT

