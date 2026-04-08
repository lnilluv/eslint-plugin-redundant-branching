#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIER="tier1"

TARGET_FILES="${1:-200}"
CORPUS_DIR="${2:-$SCRIPT_DIR/../corpus/$TIER}"
RESULTS_DIR="$SCRIPT_DIR/../results/$TIER"

if ! [[ "$TARGET_FILES" =~ ^[0-9]+$ ]] || [ "$TARGET_FILES" -le 0 ]; then
  echo "ERROR: target file count must be a positive integer (got: $TARGET_FILES)" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required but not installed." >&2
  exit 1
fi

mkdir -p "$CORPUS_DIR" "$RESULTS_DIR"

WORK_DIR="$(mktemp -d -t redundant-branching-tier1.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

MANIFEST_FILE="$RESULTS_DIR/collection-manifest.tsv"
FAILURES_FILE="$RESULTS_DIR/clone-failures.log"
SUMMARY_FILE="$RESULTS_DIR/summary.json"

printf 'repo\tsource_file\tcopied_to\n' > "$MANIFEST_FILE"
: > "$FAILURES_FILE"

REPOS=(
  "microsoft/TypeScript"
  "vercel/next.js"
  "nestjs/nest"
  "microsoft/vscode"
  "angular/angular"
  "prisma/prisma"
  "tanstack/query"
  "typeorm/typeorm"
  "apollographql/apollo-client"
  "socketio/socket.io"
)

echo "=== Collecting Tier 1 (Production OSS) ==="
echo "Target files: $TARGET_FILES"
echo "Corpus dir:   $CORPUS_DIR"
echo "Results dir:  $RESULTS_DIR"
echo

files_collected=0
repos_attempted=0
repos_succeeded=0
repos_failed=0
repo_index=0
total_repos="${#REPOS[@]}"

for repo in "${REPOS[@]}"; do
  if [ "$files_collected" -ge "$TARGET_FILES" ]; then
    break
  fi

  repo_index=$((repo_index + 1))
  repos_attempted=$((repos_attempted + 1))
  repo_name="${repo#*/}"
  repo_dir="$WORK_DIR/$repo_name"

  remaining=$((TARGET_FILES - files_collected))
  repos_left=$((total_repos - repo_index + 1))
  per_repo_quota=$(((remaining + repos_left - 1) / repos_left))
  if [ "$per_repo_quota" -gt 30 ]; then
    per_repo_quota=30
  fi

  echo "[$repo_index/$total_repos] Cloning $repo (quota: $per_repo_quota)"
  if ! git clone --depth 1 --quiet "https://github.com/$repo.git" "$repo_dir"; then
    repos_failed=$((repos_failed + 1))
    echo "$repo" >> "$FAILURES_FILE"
    echo "  -> failed to clone, skipping"
    continue
  fi

  repos_succeeded=$((repos_succeeded + 1))
  repo_collected=0

  while IFS= read -r file; do
    if [ "$files_collected" -ge "$TARGET_FILES" ]; then
      break
    fi

    relative_path="${file#$repo_dir/}"
    safe_relative_path="$(echo "$relative_path" | tr '/ ' '__')"
    destination="$CORPUS_DIR/${repo_name}__${safe_relative_path}"

    if [ -e "$destination" ]; then
      destination="$CORPUS_DIR/${repo_name}__${files_collected}__$(basename "$file")"
    fi

    cp "$file" "$destination"
    files_collected=$((files_collected + 1))
    repo_collected=$((repo_collected + 1))

    printf '%s\t%s\t%s\n' "$repo" "$relative_path" "$(basename "$destination")" >> "$MANIFEST_FILE"

    if [ $((files_collected % 10)) -eq 0 ] || [ "$files_collected" -eq "$TARGET_FILES" ]; then
      echo "  -> progress: $files_collected/$TARGET_FILES"
    fi
  done < <(
    find "$repo_dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.mts" -o -name "*.cts" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/dist/*" \
      ! -path "*/build/*" \
      ! -path "*/coverage/*" \
      ! -path "*/test/*" \
      ! -path "*/tests/*" \
      ! -path "*/__tests__/*" \
      ! -name "*.d.ts" \
      | head -n "$per_repo_quota"
  )

  echo "  -> collected $repo_collected file(s) from $repo"
done

if [ "$files_collected" -eq 0 ]; then
  echo "ERROR: No files were collected for Tier 1." >&2
  exit 1
fi

cat > "$SUMMARY_FILE" <<EOF
{
  "tier": "$TIER",
  "target_files": $TARGET_FILES,
  "files_collected": $files_collected,
  "repos_attempted": $repos_attempted,
  "repos_succeeded": $repos_succeeded,
  "repos_failed": $repos_failed,
  "manifest": "$MANIFEST_FILE",
  "generated_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "=== Tier 1 collection complete ==="
echo "Collected: $files_collected file(s)"
echo "Manifest:  $MANIFEST_FILE"
echo "Summary:   $SUMMARY_FILE"
echo "Failures:  $FAILURES_FILE"

if [ "$files_collected" -lt "$TARGET_FILES" ]; then
  echo "WARNING: Target not reached ($files_collected/$TARGET_FILES)." >&2
fi
