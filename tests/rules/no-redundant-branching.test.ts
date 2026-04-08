import { RuleTester } from "@typescript-eslint/rule-tester";
import rule, { name } from "../../src/rules/no-redundant-branching.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: false,
    },
  },
});

describe("no-redundant-branching", () => {
  ruleTester.run(name, rule, {
    valid: [
      // Scenario 3: Single chain (below threshold)
      {
        code: `
const x = status === 'a' ? 'alpha' : 'other';
        `,
      },
      // Scenario 4: Different discriminants
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = type === 'a' ? 'Alpha' : type === 'b' ? 'Beta' : 'Other';
        `,
      },
      // Scenario 5: Different branch count
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'c' ? 'Gamma' : 'Other';
        `,
      },
      // Scenario 12: Intentional parallel chains suppression via ignoreDiscriminants
      {
        code: `
const buttonVariant = theme === 'primary' ? 'bg-blue-500' : theme === 'secondary' ? 'bg-gray-500' : 'bg-transparent';
const textVariant = theme === 'primary' ? 'text-white' : theme === 'secondary' ? 'text-gray-700' : 'text-inherit';
        `,
        options: [{ ignoreDiscriminants: ["theme"] }],
      },
      // Chains in different functions (different scope)
      {
        code: `
function f1() {
  const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
}
function f2() {
  const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
}
        `,
      },
      // Different literal types are not grouped together (type preservation)
      {
        code: `
const x = status === '1' ? 'alpha' : 'beta';
const y = status === 1 ? 'Alpha' : 'Beta';
        `,
      },
      // threshold: 3, only 2 chains present
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
        `,
        options: [{ threshold: 3 }],
      },
      // includeSwitchStatements: false
      {
        code: `
const kind = 'a';
let label, desc;
switch (kind) {
  case 'a': label = 'Alpha'; break;
  case 'b': label = 'Beta'; break;
  default: label = 'Other';
}
switch (kind) {
  case 'a': desc = 'The letter A'; break;
  case 'b': desc = 'The letter B'; break;
  default: desc = 'Unknown';
}
        `,
        options: [{ includeSwitchStatements: false }],
      },
      // includeIfElseChains: false
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
        `,
        options: [{ includeIfElseChains: false }],
      },
    ],
    invalid: [
      // Scenario 1: 3 ternary chains same variable => violation + autofix
      // All chains are const declarations, so entire span is replaced
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const syncTitle = syncStatus === 'blocked' ? 'Client sync blocked'
  : syncStatus === 'offline' ? 'Client sync offline'
  : syncStatus === 'syncing' ? 'Client sync in progress'
  : 'Client sync healthy';
const syncLabel = syncStatus === 'blocked' ? 'Blocked'
  : syncStatus === 'offline' ? 'Offline'
  : syncStatus === 'syncing' ? 'Syncing'
  : 'Synced';
const syncDesc = syncStatus === 'blocked' ? 'Client is blocked'
  : syncStatus === 'offline' ? 'Client is offline'
  : syncStatus === 'syncing' ? 'Client is syncing'
  : 'Client is healthy';
        `,
        // Autofix replaces entire span from first to last declaration with lookup + destructuring
        output: `
const _syncStatus_LOOKUP = {
  "blocked": { syncTitle: 'Client sync blocked', syncLabel: 'Blocked', syncDesc: 'Client is blocked' },
  "offline": { syncTitle: 'Client sync offline', syncLabel: 'Offline', syncDesc: 'Client is offline' },
  "syncing": { syncTitle: 'Client sync in progress', syncLabel: 'Syncing', syncDesc: 'Client is syncing' }
};
const _syncStatus_DEFAULT = { syncTitle: 'Client sync healthy', syncLabel: 'Synced', syncDesc: 'Client is healthy' };
const { syncTitle, syncLabel, syncDesc } = _syncStatus_LOOKUP[syncStatus] ?? _syncStatus_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 2: 2 chains same variable threshold 2 => violation + autofix
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const syncTitle = syncStatus === 'blocked' ? 'Client sync blocked'
  : syncStatus === 'offline' ? 'Client sync offline'
  : syncStatus === 'syncing' ? 'Client sync in progress'
  : 'Client sync healthy';
const syncLabel = syncStatus === 'blocked' ? 'Blocked'
  : syncStatus === 'offline' ? 'Offline'
  : syncStatus === 'syncing' ? 'Syncing'
  : 'Synced';
        `,
        output: `
const _syncStatus_LOOKUP = {
  "blocked": { syncTitle: 'Client sync blocked', syncLabel: 'Blocked' },
  "offline": { syncTitle: 'Client sync offline', syncLabel: 'Offline' },
  "syncing": { syncTitle: 'Client sync in progress', syncLabel: 'Syncing' }
};
const _syncStatus_DEFAULT = { syncTitle: 'Client sync healthy', syncLabel: 'Synced' };
const { syncTitle, syncLabel } = _syncStatus_LOOKUP[syncStatus] ?? _syncStatus_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 6: switch statements same variable => violation
      // Switch statements are not const declarations, so no autofix
      {
        code: `
const kind = 'a';
let label, desc;
switch (kind) {
  case 'a': label = 'Alpha'; break;
  case 'b': label = 'Beta'; break;
  default: label = 'Other';
}
switch (kind) {
  case 'a': desc = 'The letter A'; break;
  case 'b': desc = 'The letter B'; break;
  default: desc = 'Unknown';
}
        `,
        // No autofix - switch statements are not const variable declarations
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 7: if-else chains same variable => violation
      // if-else with expression statements (not const declarations) => no autofix
      {
        code: `
let label, desc;
if (kind === 'a') {
  label = 'Alpha';
} else if (kind === 'b') {
  label = 'Beta';
} else {
  label = 'Other';
}
if (kind === 'a') {
  desc = 'The letter A';
} else if (kind === 'b') {
  desc = 'The letter B';
} else {
  desc = 'Unknown';
}
        `,
        // No autofix - if-else chains are not const variable declarations
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 8: mixed ternary + if-else normalized => violation
      // Mixed chains where not all are const declarations => no autofix
      {
        code: `
const x = status === 'a' ? 1 : status === 'b' ? 2 : 3;
let y;
if (status === 'a') {
  y = 10;
} else if (status === 'b') {
  y = 20;
} else {
  y = 30;
}
        `,
        // No autofix - one chain is let declaration, not const
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 9: member expression discriminant => violation + autofix
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const x = obj.status === 'a' ? 'alpha' : obj.status === 'b' ? 'beta' : 'other';
const y = obj.status === 'a' ? 'Alpha' : obj.status === 'b' ? 'Beta' : 'Other';
        `,
        output: `
const _obj_status_LOOKUP = {
  "a": { x: 'alpha', y: 'Alpha' },
  "b": { x: 'beta', y: 'Beta' }
};
const _obj_status_DEFAULT = { x: 'other', y: 'Other' };
const { x, y } = _obj_status_LOOKUP[obj.status] ?? _obj_status_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 10: reversed comparison => violation + autofix
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const x = 'blocked' === status ? 'blocked' : 'offline' === status ? 'offline' : 'synced';
const y = 'blocked' === status ? 'Client sync blocked' : 'offline' === status ? 'Client sync offline' : 'Client sync healthy';
        `,
        output: `
const _status_LOOKUP = {
  "blocked": { x: 'blocked', y: 'Client sync blocked' },
  "offline": { x: 'offline', y: 'Client sync offline' }
};
const _status_DEFAULT = { x: 'synced', y: 'Client sync healthy' };
const { x, y } = _status_LOOKUP[status] ?? _status_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Scenario 11: default/fallback handling in autofix (no fallback in lookup)
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
        `,
        output: `
const _status_LOOKUP = {
  "a": { x: 'alpha', y: 'Alpha' },
  "b": { x: 'beta', y: 'Beta' }
};
const _status_DEFAULT = { x: 'other', y: 'Other' };
const { x, y } = _status_LOOKUP[status] ?? _status_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Non-const declaration => no autofix (report without fix)
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
let y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Side effects in consequent => no autofix (safety check)
      {
        code: `
const x = status === 'a' ? doSomething() : status === 'b' ? doOther() : 'other';
const y = status === 'a' ? doAlpha() : status === 'b' ? doBeta() : 'default';
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Chains separated by code => no autofix (contiguity check)
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
console.log('side effect');
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Expression statement if-else chains (no const assignment) => no autofix
      {
        code: `
const kind = 'a';
if (kind === 'a') {
  label = 'Alpha';
} else if (kind === 'b') {
  label = 'Beta';
} else {
  label = 'Other';
}
if (kind === 'a') {
  desc = 'The letter A';
} else if (kind === 'b') {
  desc = 'The letter B';
} else {
  desc = 'Unknown';
}
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // Mixed ternary + switch with canonical normalization
      // Both use same discriminant 'kind' and same case values 'a', 'b'
      // Switch case keys must normalize to same canonical form as ternary test values
      {
        code: `
const kind = 'a';
const x = kind === 'a' ? 'alpha' : kind === 'b' ? 'beta' : 'other';
const y = kind === 'a' ? 'Alpha' : kind === 'b' ? 'Beta' : 'Other';
switch (kind) {
  case 'a':
    return 'A';
  case 'b':
    return 'B';
  default:
    return 'Z';
}
        `,
        // All are const declarations but switch is not const assignment so no autofix
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // All chains have fallbacks => generates _DEFAULT object
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'fallback_x';
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'fallback_y';
        `,
        output: `
const _status_LOOKUP = {
  "a": { x: 'alpha', y: 'Alpha' },
  "b": { x: 'beta', y: 'Beta' }
};
const _status_DEFAULT = { x: 'fallback_x', y: 'fallback_y' };
const { x, y } = _status_LOOKUP[status] ?? _status_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
      // 3 chains with fallbacks - all generate _DEFAULT together
      {
        code: `
const x = status === 'a' ? 'alpha' : status === 'b' ? 'beta' : 'other';
const y = status === 'a' ? 'Alpha' : status === 'b' ? 'Beta' : 'Other';
const z = status === 'a' ? 'z1' : status === 'b' ? 'z2' : 'z3';
        `,
        output: `
const _status_LOOKUP = {
  "a": { x: 'alpha', y: 'Alpha', z: 'z1' },
  "b": { x: 'beta', y: 'Beta', z: 'z2' }
};
const _status_DEFAULT = { x: 'other', y: 'Other', z: 'z3' };
const { x, y, z } = _status_LOOKUP[status] ?? _status_DEFAULT;
        `,
        errors: [
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
          { messageId: "redundantBranching" },
        ],
      },
    ],
  });
});
