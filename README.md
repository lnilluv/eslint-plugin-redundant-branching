# eslint-plugin-redundant-branching

Detect when multiple conditional chains branch on the same discriminant with the same structure but different leaf values, and generate an autofix that produces a lookup table.

## Installation

```bash
npm install --save-dev eslint-plugin-redundant-branching
```

## Usage

### Flat Config (ESLint v9)

```js
import redundantBranching from "eslint-plugin-redundant-branching";

export default [
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

### Configuration Options

```js
{
  rules: {
    "redundant-branching/no-redundant-branching": ["error", {
      threshold: 2,              // Minimum number of chains to report (default: 2)
      includeSwitchStatements: true,  // Include switch statements (default: true)
      includeIfElseChains: true,     // Include if-else chains (default: true)
    }]
  }
}
```

### Recommended Config

```js
import redundantBranching from "eslint-plugin-redundant-branching";

export default [
  redundantBranching.configs.recommended,
];
```

## Rule Details

This rule detects when 2+ conditional chains in the same scope share:
- The **same discriminant** (the variable being compared)
- The **same set of branch keys** (the literal values being tested)
- But have **different leaf values**

### Examples

#### Detected: Redundant branching

```ts
// ❌ Multiple chains branch on the same discriminant
const clientSyncStatus =
  sync.uploadStatus === "blocked" ? "blocked"
  : sync.connectionStatus === "offline" ? "offline"
  : sync.connectionStatus === "starting" ? "syncing"
  : "synced";

const clientSyncTitle =
  clientSyncStatus === "blocked" ? "Client sync blocked"
  : clientSyncStatus === "offline" ? "Client sync offline"
  : clientSyncStatus === "syncing" ? "Client sync in progress"
  : "Client sync healthy";

const syncStateLabel =
  clientSyncStatus === "blocked" ? "Blocked"
  : clientSyncStatus === "offline" ? "Offline"
  : clientSyncStatus === "syncing" ? "Syncing"
  : "Synced";
```

#### Auto-fixed: Lookup table

```ts
// ✅ Auto-fixed to a lookup table
const _SYNC_LOOKUP = {
  blocked: { clientSyncStatus: "blocked", clientSyncTitle: "Client sync blocked", syncStateLabel: "Blocked" },
  offline: { clientSyncStatus: "offline", clientSyncTitle: "Client sync offline", syncStateLabel: "Offline" },
  starting: { clientSyncStatus: "syncing", clientSyncTitle: "Client sync in progress", syncStateLabel: "Syncing" },
};
const { clientSyncStatus, clientSyncTitle, syncStateLabel } = _SYNC_LOOKUP[sync.uploadStatus] ?? {};
```

### Supported Forms

- **Ternary chains**: `a ? x : b ? y : c ? z : d`
- **If-else chains**: `if (a) {} else if (b) {} else {}`
- **Switch statements**: `switch (x) { case 'a': ... case 'b': ... default: ... }`
- **Mixed forms**: A ternary and a switch can be grouped together

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Different discriminants | Valid (no error) |
| Different branch sets | Valid (no error) |
| Side effects in leaves (e.g., `doSomething()`) | Reports violation but skips autofix |
| Chains in different functions | Valid (no error) |
| Threshold > 2 | Only reports when chains >= threshold |

### Not Reported

```ts
// ✅ Different discriminants - intentional parallel branching
const buttonClass = theme === 'primary' ? 'btn-primary' : 'btn-secondary';
const textClass = color === 'primary' ? 'text-primary' : 'text-secondary';

// ✅ Different branch sets (no overlap)
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'c' ? 'Gamma' : 'Other';
```

## Motivation

AI models (and sometimes humans) generate code where the same branching logic is repeated multiple times with different leaf values. Each expression is locally fine, but together they're redundant.

## Architecture

```
src/
├── index.ts                      # Plugin entry point
├── rules/
│   └── no-redundant-branching.ts  # The ESLint rule
└── utils/
    ├── types.ts                  # Shared type definitions
    ├── discriminant.ts            # Extract discriminant from comparisons
    ├── chain-extractor.ts        # AST → ChainDescriptor for ternary/if-else/switch
    ├── normalizer.ts             # Structure normalization + hashing
    └── autofix.ts                # Lookup table code generation
```

## License

MIT
