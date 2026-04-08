#!/bin/bash
# Quick analysis of Tier 5 samples

set -e

cd "$(dirname "$0")/../corpus"

echo "=== Quick Analysis: Tier 5 ==="
echo ""

# Count total files
TOTAL=$(ls tier5/*.ts 2>/dev/null | wc -l)
echo "Total files: $TOTAL"

# Run ESLint and count detections
DETECTIONS=0
FILES_WITH_DETECTIONS=0

for file in tier5/*.ts; do
  COUNT=$(npx eslint "$file" --format json 2>/dev/null | jq '[.[].messages[] | select(.ruleId == "redundant-branching/no-redundant-branching")] | length' || echo "0")
  if [ "$COUNT" -gt 0 ]; then
    DETECTIONS=$((DETECTIONS + COUNT))
    FILES_WITH_DETECTIONS=$((FILES_WITH_DETECTIONS + 1))
    echo "  $(basename $file): $COUNT detection(s)"
  fi
done

echo ""
echo "=== Results ==="
echo "Files with detections: $FILES_WITH_DETECTIONS / $TOTAL"
echo "Total detections: $DETECTIONS"
echo "Prevalence rate: $(echo "scale=2; $FILES_WITH_DETECTIONS * 100 / $TOTAL" | bc)%"
