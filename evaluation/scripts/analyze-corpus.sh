#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_PATH="$SCRIPT_DIR/../../dist/index.js"

TIER="${1:-tier1}"
CORPUS_DIR="${2:-$SCRIPT_DIR/../corpus/$TIER}"
RESULTS_DIR="$SCRIPT_DIR/../results/$TIER"

if [ ! -f "$PLUGIN_PATH" ]; then
  echo "ERROR: ESLint plugin not found at $PLUGIN_PATH" >&2
  exit 1
fi

if [ ! -d "$CORPUS_DIR" ]; then
  echo "ERROR: Corpus directory not found: $CORPUS_DIR" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx is required but not installed." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required but not installed." >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"

FILE_LIST="$(mktemp -t redundant-branching-files.XXXXXX)"
ESLINT_CONFIG="$(mktemp -t redundant-branching-eslint.XXXXXX.mjs)"
ESLINT_JSON="$(mktemp -t redundant-branching-eslint-out.XXXXXX.json)"
ESLINT_ERR="$(mktemp -t redundant-branching-eslint-err.XXXXXX.log)"

trap 'rm -f "$FILE_LIST" "$ESLINT_CONFIG" "$ESLINT_JSON" "$ESLINT_ERR"' EXIT

DETECTIONS_FILE="$RESULTS_DIR/detections.jsonl"
FAILED_FILE="$RESULTS_DIR/failed-files.txt"
SUMMARY_FILE="$RESULTS_DIR/summary.json"

: > "$DETECTIONS_FILE"
: > "$FAILED_FILE"

cat > "$ESLINT_CONFIG" <<EOF
import plugin from "${PLUGIN_PATH}";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "redundant-branching": plugin
    },
    rules: {
      "redundant-branching/no-redundant-branching": "warn"
    }
  }
];
EOF

find "$CORPUS_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/coverage/*" \
  ! -name "*.d.ts" \
  > "$FILE_LIST"

TOTAL_FILES="$(wc -l < "$FILE_LIST" | tr -d ' ')"
if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "ERROR: No TypeScript files found in $CORPUS_DIR" >&2
  exit 1
fi

echo "=== Analyzing corpus: $TIER ==="
echo "Plugin:  $PLUGIN_PATH"
echo "Corpus:  $CORPUS_DIR"
echo "Results: $RESULTS_DIR"
echo "Files:   $TOTAL_FILES"
echo

processed_files=0
failed_files=0
files_with_detections=0
total_detections=0

while IFS= read -r file; do
  processed_files=$((processed_files + 1))
  printf '[%d/%d] %s\n' "$processed_files" "$TOTAL_FILES" "$file"

  if ! npx eslint --config "$ESLINT_CONFIG" --format json --no-error-on-unmatched-pattern "$file" > "$ESLINT_JSON" 2> "$ESLINT_ERR"; then
    failed_files=$((failed_files + 1))
    echo "$file" >> "$FAILED_FILE"
    echo "  -> warning: ESLint failed for this file (see $FAILED_FILE)." >&2
    continue
  fi

  detection_count_for_file="$(node - "$ESLINT_JSON" "$file" "$DETECTIONS_FILE" <<'NODE'
const fs = require('fs');

const reportPath = process.argv[2];
const filePath = process.argv[3];
const detectionsPath = process.argv[4];

const raw = fs.readFileSync(reportPath, 'utf8').trim();
if (!raw) {
  process.stdout.write('0');
  process.exit(0);
}

let reports;
try {
  reports = JSON.parse(raw);
} catch (error) {
  console.error(`Failed to parse ESLint JSON for ${filePath}: ${error.message}`);
  process.exit(2);
}

let count = 0;
const lines = [];

for (const report of reports) {
  for (const message of report.messages || []) {
    if (message.ruleId === 'redundant-branching/no-redundant-branching') {
      count += 1;
      lines.push(
        JSON.stringify({
          file: filePath,
          line: message.line,
          column: message.column,
          message: message.message,
          severity: message.severity
        })
      );
    }
  }
}

if (lines.length > 0) {
  fs.appendFileSync(detectionsPath, `${lines.join('\n')}\n`);
}

process.stdout.write(String(count));
NODE
)"

  if [ "$detection_count_for_file" -gt 0 ]; then
    files_with_detections=$((files_with_detections + 1))
    total_detections=$((total_detections + detection_count_for_file))
    echo "  -> detections: $detection_count_for_file"
  fi
done < "$FILE_LIST"

prevalence_rate="$(awk -v hit="$files_with_detections" -v total="$TOTAL_FILES" 'BEGIN { if (total == 0) print "0"; else printf "%.6f", hit / total }')"
detection_density="$(awk -v det="$total_detections" -v hit="$files_with_detections" 'BEGIN { if (hit == 0) print "0"; else printf "%.6f", det / hit }')"

cat > "$SUMMARY_FILE" <<EOF
{
  "tier": "$TIER",
  "plugin_path": "$PLUGIN_PATH",
  "corpus_dir": "$CORPUS_DIR",
  "total_files_analyzed": $TOTAL_FILES,
  "files_processed": $processed_files,
  "files_with_detections": $files_with_detections,
  "total_detections": $total_detections,
  "failed_files": $failed_files,
  "prevalence_rate": $prevalence_rate,
  "detection_density_per_positive_file": $detection_density,
  "analyzed_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "=== Analysis complete ($TIER) ==="
echo "Summary:    $SUMMARY_FILE"
echo "Detections: $DETECTIONS_FILE"
echo "Failures:   $FAILED_FILE"
