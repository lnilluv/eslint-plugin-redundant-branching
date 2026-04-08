# eslint-plugin-redundant-branching

[![npm version](https://img.shields.io/npm/v/eslint-plugin-redundant-branching.svg)](https://www.npmjs.com/package/eslint-plugin-redundant-branching)
[![license](https://img.shields.io/npm/l/eslint-plugin-redundant-branching.svg)](LICENSE)

> Detect redundant conditional chains and automatically transform them into lookup tables.

## The Problem

When the same conditional logic is repeated with different outputs, the code becomes harder to maintain and extend:

```typescript
// ❌ Redundant — same branching, different values
const statusLabel =
  status === "loading" ? "Loading..."
  : status === "error" ? "Error occurred"
  : status === "success" ? "Done!"
  : "Unknown";

const statusIcon =
  status === "loading" ? "⏳"
  : status === "error" ? "❌"
  : status === "success" ? "✅"
  : "❓";

const statusColor =
  status === "loading" ? "blue"
  : status === "error" ? "red"
  : status === "success" ? "green"
  : "gray";
```

## The Solution

This plugin detects these patterns and auto-fixes them into clean lookup tables:

```typescript
// ✅ Clean — single source of truth
const _status_LOOKUP = {
  loading: { statusLabel: "Loading...", statusIcon: "⏳", statusColor: "blue" },
  error:   { statusLabel: "Error occurred", statusIcon: "❌", statusColor: "red" },
  success: { statusLabel: "Done!", statusIcon: "✅", statusColor: "green" }
};
const _status_DEFAULT = { statusLabel: "Unknown", statusIcon: "❓", statusColor: "gray" };
const { statusLabel, statusIcon, statusColor } = _status_LOOKUP[status] ?? _status_DEFAULT;
```

---

## Installation

```bash
# npm
npm install --save-dev eslint-plugin-redundant-branching

# yarn
yarn add --dev eslint-plugin-redundant-branching

# pnpm
pnpm add --save-dev eslint-plugin-redundant-branching
```

**Requirements:**
- ESLint >= 9.0.0 (flat config)
- TypeScript >= 4.0.0 (if using TypeScript)

---

## Quick Start

### Flat Config (ESLint v9+)

```javascript
// eslint.config.js
import redundantBranching from "eslint-plugin-redundant-branching";

export default [
  // ...your other config
  {
    plugins: {
      "redundant-branching": redundantBranching,
    },
    rules: {
      "redundant-branching/no-redundant-branching": "error",
    },
  },
];
```

### Recommended Config

```javascript
// eslint.config.js
import redundantBranching from "eslint-plugin-redundant-branching";

export default [
  redundantBranching.configs.recommended,
  // ...your other config
];
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `2` | Minimum number of chains required to trigger a report |
| `includeSwitchStatements` | `boolean` | `true` | Include `switch` statements in detection |
| `includeIfElseChains` | `boolean` | `true` | Include `if/else if/else` chains in detection |
| `ignoreDiscriminants` | `string[]` | `[]` | Discriminants to ignore (for intentional parallel chains) |

### Example Configuration

```javascript
{
  rules: {
    "redundant-branching/no-redundant-branching": ["error", {
      threshold: 3,                    // Only report when 3+ chains found
      includeSwitchStatements: true,
      includeIfElseChains: true,
      ignoreDiscriminants: ["theme"]   // Allow parallel theme-based chains
    }]
  }
}
```

---

## What Gets Detected

### ✅ Detected (will be flagged)

```typescript
// Ternary chains on same discriminant
const a = x === 1 ? "one" : x === 2 ? "two" : "other";
const b = x === 1 ? "1️⃣" : x === 2 ? "2️⃣" : "❓";

// If-else chains
if (type === "A") result = "alpha";
else if (type === "B") result = "beta";
else result = "unknown";

// Switch statements
switch (type) {
  case "A": return "alpha";
  case "B": return "beta";
}

// Mixed forms (ternary + switch)
const a = type === "A" ? "alpha" : "other";
switch (type) {
  case "A": return "alpha";
}
```

### ✅ Not Detected (intentionally valid)

```typescript
// Different discriminants — intentional parallel logic
const buttonClass = theme === "dark" ? "btn-dark" : "btn-light";
const textClass = mode === "dark" ? "text-white" : "text-black";

// Different branch sets — no structural redundancy
const x = status === "a" ? 1 : status === "b" ? 2 : 3;
const y = status === "a" ? 10 : status === "c" ? 30 : 40;  // 'b' vs 'c'

// Below threshold
const x = status === "a" ? 1 : 2;  // Single chain

// Suppressed via ignoreDiscriminants
const buttonVariant = theme === "primary" ? "btn-primary" : "btn-secondary";
const textVariant = theme === "primary" ? "text-primary" : "text-secondary";
// With: ignoreDiscriminants: ["theme"]
```

---

## Safety

The autofix is **conservative** — it only transforms code when it's 100% safe:

| Scenario | Behavior |
|----------|----------|
| Side effects in branches | Reports, but no autofix |
| Non-contiguous chains | Reports, but no autofix |
| Non-const declarations | Reports, but no autofix |
| Complex expressions | Reports, but no autofix |

---

## Motivation

This pattern commonly appears in:

- **AI-generated code** — LLMs often repeat conditional logic
- **UI component libraries** — theme/style mappings
- **API response handling** — status code mappings
- **Internationalization** — locale-based conditional text

The lookup table pattern is:
- **More readable** — data is separated from logic
- **Easier to extend** — add a new key in one place
- **More maintainable** — single source of truth
- **Better for bundlers** — static data can be optimized

---

## Architecture

```
src/
├── index.ts                      # Plugin entry point
├── rules/
│   └── no-redundant-branching.ts  # Main ESLint rule
└── utils/
    ├── types.ts                  # TypeScript definitions
    ├── discriminant.ts           # Extract discriminant from comparisons
    ├── chain-extractor.ts        # Parse ternary/if-else/switch chains
    ├── normalizer.ts             # Group chains by structure
    └── autofix.ts                # Generate lookup table code
```

---

## Contributing

Contributions welcome! Please open an issue or PR.

```bash
# Clone
git clone https://github.com/lnilluv/eslint-plugin-redundant-branching.git
cd eslint-plugin-redundant-branching

# Install dependencies
npm install

# Run tests
npm test

# Run type check
npm run typecheck

# Build
npm run build
```

---

## License

MIT © [lnilluv](https://github.com/lnilluv)
