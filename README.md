# eslint-plugin-redundant-branching

[![npm version](https://img.shields.io/npm/v/eslint-plugin-redundant-branching.svg)](https://www.npmjs.com/package/eslint-plugin-redundant-branching)
[![license](https://img.shields.io/npm/l/eslint-plugin-redundant-branching.svg)](LICENSE)

Finds repeated conditional logic on the same variable and replaces it with a lookup table.

## Why

Code that branches on the same discriminant multiple times scatters related data across parallel structures. Adding a new case means editing every branch. Miss one and you ship a bug.

This pattern spreads fast in AI-assisted workflows. When existing code contains a ternary chain, AI models copy the style instead of refactoring — [100% of the time in our tests](experiment/results/MIMICRY_REPORT.md).

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
npm install --save-dev eslint-plugin-redundant-branching
```

Requires ESLint 9+ (flat config).

## Setup

```javascript
// eslint.config.js
import redundantBranching from "eslint-plugin-redundant-branching";

export default [
  {
    plugins: { "redundant-branching": redundantBranching },
    rules: { "redundant-branching/no-redundant-branching": "error" },
  },
];
```

Or use the recommended config:

```javascript
import redundantBranching from "eslint-plugin-redundant-branching";
export default [redundantBranching.configs.recommended];
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
"redundant-branching/no-redundant-branching": ["error", {
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

## How AI spreads this pattern

AI models are next-token predictors. When context contains a ternary chain, the most likely continuation is another ternary chain — not a refactoring into a lookup table.

We tested this with Claude Sonnet 4, GPT-4o, and GPT-4o-mini. Given existing code with one chain and the instruction "add a label for the same statuses," every model added another chain. Every time. Across 19 test scenarios.

The same models write lookup tables from scratch when given no existing code. The pattern emerges through mimicry, not inability.

This plugin breaks the cycle. Run it in CI to catch accumulated redundancy before it merges.

---

## AI harness integration

This plugin also integrates with AI coding agents, so it flags redundant branching while code is being generated instead of waiting for CI. This repository includes setups for three harnesses: pi.dev, Claude Code, and opencode.

| Harness | Mechanism | Setup |
|---------|-----------|-------|
| pi.dev | Extension with auto-lint and `/lint-branching` command | `pi install npm:pi-lookup-lint` |
| Claude Code | PostToolUse hook runs ESLint after every file write | Copy `.claude/` from `harness-configs/claude-code/` |
| opencode | Plugin runs ESLint after every file edit | Copy `.opencode/` from `harness-configs/opencode/` |

See `harness-configs/README.md` for full setup instructions.

---

## Architecture

```
src/
├── index.ts                       # Plugin entry
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
git clone https://github.com/lnilluv/eslint-plugin-redundant-branching.git
cd eslint-plugin-redundant-branching
npm install
npm test        # 32 tests
npm run typecheck
npm run build
```

---

## License

MIT
