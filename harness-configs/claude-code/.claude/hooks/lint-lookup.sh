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
