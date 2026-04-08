#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"

case "$MODE" in
  ai|human|all) ;;
  *)
    echo "Usage: $0 [ai|human|all]" >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AI_DIR="$REPO_ROOT/experiment/ai-corpus"
HUMAN_DIR="$REPO_ROOT/experiment/human-corpus"
RESULTS_DIR="$REPO_ROOT/experiment/results"

AI_OUTPUT="$RESULTS_DIR/analysis-ai.jsonl"
HUMAN_OUTPUT="$RESULTS_DIR/analysis-human.jsonl"

CONFIG_PATH="/tmp/experiment-eslint.config.js"
PLUGIN_PATH="$REPO_ROOT/dist/index.js"
PARSER_PATH="$REPO_ROOT/node_modules/@typescript-eslint/parser/dist/index.js"
ESLINT_BIN="$REPO_ROOT/node_modules/.bin/eslint"

mkdir -p "$RESULTS_DIR"

cat > "$CONFIG_PATH" <<EOF
import parser from "$PARSER_PATH";
import redundantBranching from "$PLUGIN_PATH";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        project: null,
      },
    },
    plugins: {
      "redundant-branching": redundantBranching,
    },
    rules: {
      "redundant-branching/no-redundant-branching": "error",
    },
  },
];
EOF

ESLINT_NODE_OPTIONS="--experimental-default-type=module"
if [ -n "${NODE_OPTIONS:-}" ]; then
  ESLINT_NODE_OPTIONS="$NODE_OPTIONS $ESLINT_NODE_OPTIONS"
fi

process_source() {
  local source="$1"
  local source_dir="$2"
  local output_file="$3"

  : > "$output_file"

  mapfile -t files < <(find "$source_dir" -type f \( -name "*.ts" -o -name "*.tsx" \) | sort)

  for file_path in "${files[@]}"; do
    local file_name model prompt_id prompt_category repo relative_path prefix
    file_name="$(basename "$file_path")"
    model="null"
    prompt_id="null"
    prompt_category="null"
    repo="null"

    if [ "$source" = "ai" ]; then
      if [[ "$file_name" =~ ^ai-(.+)-([A-Za-z][0-9]+)\.tsx?$ ]]; then
        model="${BASH_REMATCH[1]}"
        prompt_id="${BASH_REMATCH[2]}"
        prefix="${prompt_id:0:1}"
        prefix="${prefix^^}"
        case "$prefix" in
          H) prompt_category="high" ;;
          M) prompt_category="medium" ;;
          L) prompt_category="low" ;;
          *) prompt_category="null" ;;
        esac
      fi
    else
      relative_path="${file_path#"$source_dir"/}"
      if [[ "$relative_path" == */* ]]; then
        repo="${relative_path%%/*}"
      fi
    fi

    local loc eslint_output eslint_status json_line
    loc="$(wc -l < "$file_path")"
    loc="${loc//[[:space:]]/}"

    set +e
    eslint_output="$(NODE_OPTIONS="$ESLINT_NODE_OPTIONS" "$ESLINT_BIN" --config "$CONFIG_PATH" --format json "$file_path" 2>/dev/null)"
    eslint_status=$?
    set -e

    json_line="$(node -e '
const fs = require("fs");
const [file, source, modelArg, promptIdArg, promptCategoryArg, repoArg, locArg, statusArg] = process.argv.slice(1);
const input = fs.readFileSync(0, "utf8");
const status = Number(statusArg);

const nullable = (value) => (value === "null" ? null : value);

let parsed = null;
if (input.trim() !== "") {
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = null;
  }
}

const parseError = status !== 0 && (!parsed || !Array.isArray(parsed));
const detections = [];

if (Array.isArray(parsed)) {
  for (const result of parsed) {
    if (!result || !Array.isArray(result.messages)) continue;
    for (const message of result.messages) {
      if (message && message.ruleId === "redundant-branching/no-redundant-branching") {
        detections.push({
          line: typeof message.line === "number" ? message.line : null,
          message: typeof message.message === "string" ? message.message : "",
        });
      }
    }
  }
}

const loc = Number(locArg);
const record = {
  file,
  source,
  model: nullable(modelArg),
  promptId: nullable(promptIdArg),
  promptCategory: nullable(promptCategoryArg),
  repo: nullable(repoArg),
  parseError,
  detectionCount: detections.length,
  detections,
  loc: Number.isFinite(loc) ? loc : 0,
};

process.stdout.write(JSON.stringify(record));
' "$file_name" "$source" "$model" "$prompt_id" "$prompt_category" "$repo" "$loc" "$eslint_status" <<< "$eslint_output")"

    printf '%s\n' "$json_line" >> "$output_file"
  done
}

summary_files=()

if [ "$MODE" = "ai" ] || [ "$MODE" = "all" ]; then
  process_source "ai" "$AI_DIR" "$AI_OUTPUT"
  summary_files+=("$AI_OUTPUT")
fi

if [ "$MODE" = "human" ] || [ "$MODE" = "all" ]; then
  process_source "human" "$HUMAN_DIR" "$HUMAN_OUTPUT"
  summary_files+=("$HUMAN_OUTPUT")
fi

node -e '
const fs = require("fs");

let totalFiles = 0;
let parseErrors = 0;
let filesWithDetections = 0;
let totalDetections = 0;

for (const file of process.argv.slice(1)) {
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    totalFiles += 1;
    if (entry.parseError) parseErrors += 1;
    if ((entry.detectionCount || 0) > 0) filesWithDetections += 1;
    totalDetections += entry.detectionCount || 0;
  }
}

console.log(`Summary: total files=${totalFiles}, parse errors=${parseErrors}, files with detections=${filesWithDetections}, total detections=${totalDetections}`);
' "${summary_files[@]}"
