#!/usr/bin/env bash
set -euo pipefail

BASE_CLONE_DIR="/tmp/human-repos"
OUTPUT_BASE_DIR="experiment/human-corpus"
MANIFEST_PATH="experiment/results/human-corpus-manifest.tsv"

repos=(
  "microsoft/TypeScript"
  "vercel/next.js"
  "remix-run/remix"
  "mantinedev/mantine"
  "chakra-ui/chakra-ui"
  "radix-ui/primitives"
  "colinhacks/zod"
  "calcom/cal.com"
  "excalidraw/excalidraw"
  "ianstormtaylor/slate"
  "nocodb/nocodb"
  "dubinc/dub"
  "t3-oss/create-t3-app"
  "lobehub/lobe-chat"
  "toeverything/AFFiNE"
)

mkdir -p "$BASE_CLONE_DIR" "$OUTPUT_BASE_DIR" "$(dirname "$MANIFEST_PATH")"
printf "repo\toriginal_path\tsampled_filename\n" > "$MANIFEST_PATH"

summary_repo=()
summary_total=()
summary_sampled=()

for full_repo in "${repos[@]}"; do
  repo_name="${full_repo##*/}"
  repo_dir="$BASE_CLONE_DIR/$repo_name"
  output_dir="$OUTPUT_BASE_DIR/$repo_name"

  if [ ! -d "$repo_dir/.git" ]; then
    echo "Cloning $full_repo into $repo_dir"
    git clone --depth 1 "https://github.com/$full_repo.git" "$repo_dir"
  else
    echo "Skipping clone for $full_repo (already exists)"
  fi

  rm -rf "$output_dir"
  mkdir -p "$output_dir"

  mapfile -t all_files < <(
    cd "$repo_dir"
    find . \
      \( -type d \( -name node_modules -o -name dist -o -name build -o -name .next -o -name __tests__ -o -name generated \) -prune \) -o \
      \( -type f \( -name "*.ts" -o -name "*.tsx" \) \
        ! -name "*.test.*" \
        ! -name "*.spec.*" \
        ! -name "*.d.ts" \
        ! -name "*.config.ts" \
        -print \) \
      | sed 's|^\./||'
  )

  total_files=${#all_files[@]}

  sampled_files=()
  if (( total_files > 0 )); then
    mapfile -t sampled_files < <(printf '%s\n' "${all_files[@]}" | sort -R | head -300 || true)
  fi

  sample_count=${#sampled_files[@]}

  idx=1
  for rel_path in "${sampled_files[@]}"; do
    [ -n "$rel_path" ] || continue

    base_name="$(basename "$rel_path")"
    sampled_name="$base_name"

    if [ -e "$output_dir/$sampled_name" ]; then
      sampled_name="${idx}_${base_name}"
      while [ -e "$output_dir/$sampled_name" ]; do
        idx=$((idx + 1))
        sampled_name="${idx}_${base_name}"
      done
    fi

    cp "$repo_dir/$rel_path" "$output_dir/$sampled_name"
    printf "%s\t%s\t%s\n" "$repo_name" "$rel_path" "$sampled_name" >> "$MANIFEST_PATH"
    idx=$((idx + 1))
  done

  summary_repo+=("$repo_name")
  summary_total+=("$total_files")
  summary_sampled+=("$sample_count")

done

printf "\n%-20s %15s %15s\n" "repo" "total_ts_files" "files_sampled"
printf "%-20s %15s %15s\n" "--------------------" "---------------" "-------------"
for i in "${!summary_repo[@]}"; do
  printf "%-20s %15d %15d\n" "${summary_repo[$i]}" "${summary_total[$i]}" "${summary_sampled[$i]}"
done

echo "\nManifest written to: $MANIFEST_PATH"
