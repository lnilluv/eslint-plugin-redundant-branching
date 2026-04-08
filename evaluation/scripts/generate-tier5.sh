#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIER="tier5"

TARGET_FILES="${1:-120}"
CORPUS_DIR="${2:-$SCRIPT_DIR/../corpus/$TIER}"
RESULTS_DIR="$SCRIPT_DIR/../results/$TIER"

if ! [[ "$TARGET_FILES" =~ ^[0-9]+$ ]] || [ "$TARGET_FILES" -le 0 ]; then
  echo "ERROR: target file count must be a positive integer (got: $TARGET_FILES)" >&2
  exit 1
fi

mkdir -p "$CORPUS_DIR" "$RESULTS_DIR"

MANIFEST_FILE="$RESULTS_DIR/generation-manifest.tsv"
SUMMARY_FILE="$RESULTS_DIR/summary.json"

printf 'file\tpattern\texpected_detection\n' > "$MANIFEST_FILE"

# Remove previously generated Tier 5 files to keep runs reproducible.
find "$CORPUS_DIR" -maxdepth 1 -type f -name 'ai-sample-*.ts' -delete

echo "=== Generating Tier 5 (AI-generated synthetic samples) ==="
echo "Target files: $TARGET_FILES"
echo "Corpus dir:   $CORPUS_DIR"
echo "Results dir:  $RESULTS_DIR"
echo

expected_hits=0
expected_misses=0

for i in $(seq 1 "$TARGET_FILES"); do
  sample_id="$(printf '%03d' "$i")"
  file_name="ai-sample-${sample_id}.ts"
  file_path="$CORPUS_DIR/$file_name"

  pattern_selector=$((i % 4))

  if [ "$pattern_selector" -eq 1 ]; then
    pattern="repeated-ternary-chain"
    expected="hit"
    expected_hits=$((expected_hits + 1))
    cat > "$file_path" <<EOF
// Synthetic AI sample #$sample_id
// Pattern: repeated ternary chains (expected plugin detection)

export function classifyValue${sample_id}(kind: string) {
  const label = kind === 'alpha' ? 'Alpha' : kind === 'beta' ? 'Beta' : kind === 'gamma' ? 'Gamma' : 'Other';
  const color = kind === 'alpha' ? 'blue' : kind === 'beta' ? 'purple' : kind === 'gamma' ? 'green' : 'gray';
  const score = kind === 'alpha' ? 10 : kind === 'beta' ? 20 : kind === 'gamma' ? 30 : 0;

  return { label, color, score };
}
EOF

  elif [ "$pattern_selector" -eq 2 ]; then
    pattern="duplicated-if-else-chain"
    expected="hit"
    expected_hits=$((expected_hits + 1))
    cat > "$file_path" <<EOF
// Synthetic AI sample #$sample_id
// Pattern: duplicated if/else chains (expected plugin detection)

export function mapStatus${sample_id}(status: string) {
  let label: string;
  let icon: string;

  if (status === 'pending') {
    label = 'Pending';
  } else if (status === 'running') {
    label = 'Running';
  } else if (status === 'done') {
    label = 'Done';
  } else {
    label = 'Unknown';
  }

  if (status === 'pending') {
    icon = '⏳';
  } else if (status === 'running') {
    icon = '🏃';
  } else if (status === 'done') {
    icon = '✅';
  } else {
    icon = '❔';
  }

  return { label, icon };
}
EOF

  elif [ "$pattern_selector" -eq 3 ]; then
    pattern="parallel-branching-return"
    expected="hit"
    expected_hits=$((expected_hits + 1))
    cat > "$file_path" <<EOF
// Synthetic AI sample #$sample_id
// Pattern: parallel branching for metadata (expected plugin detection)

export function buildRoleInfo${sample_id}(role: string) {
  const permissions = role === 'admin'
    ? ['read', 'write', 'delete']
    : role === 'editor'
      ? ['read', 'write']
      : role === 'viewer'
        ? ['read']
        : [];

  const dashboard = role === 'admin'
    ? 'admin-dashboard'
    : role === 'editor'
      ? 'editor-dashboard'
      : role === 'viewer'
        ? 'viewer-dashboard'
        : 'guest-dashboard';

  return { permissions, dashboard };
}
EOF

  else
    pattern="object-lookup-control"
    expected="miss"
    expected_misses=$((expected_misses + 1))
    cat > "$file_path" <<EOF
// Synthetic AI sample #$sample_id
// Pattern: object lookup control (expected no detection)

type Item = { label: string; color: string; score: number };

const ITEM_MAP: Record<string, Item> = {
  alpha: { label: 'Alpha', color: 'blue', score: 10 },
  beta: { label: 'Beta', color: 'purple', score: 20 },
  gamma: { label: 'Gamma', color: 'green', score: 30 }
};

export function lookupValue${sample_id}(kind: string): Item {
  return ITEM_MAP[kind] ?? { label: 'Other', color: 'gray', score: 0 };
}
EOF
  fi

  printf '%s\t%s\t%s\n' "$file_name" "$pattern" "$expected" >> "$MANIFEST_FILE"

  if [ "$i" -eq 1 ] || [ $((i % 10)) -eq 0 ] || [ "$i" -eq "$TARGET_FILES" ]; then
    echo "Progress: $i/$TARGET_FILES"
  fi
done

cat > "$SUMMARY_FILE" <<EOF
{
  "tier": "$TIER",
  "target_files": $TARGET_FILES,
  "files_generated": $TARGET_FILES,
  "expected_hits": $expected_hits,
  "expected_misses": $expected_misses,
  "manifest": "$MANIFEST_FILE",
  "generated_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "=== Tier 5 generation complete ==="
echo "Generated: $TARGET_FILES file(s)"
echo "Manifest:  $MANIFEST_FILE"
echo "Summary:   $SUMMARY_FILE"
