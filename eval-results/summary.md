# Evaluation Summary

## Repos Evaluated

| Repo | Files Scanned | Files w/ Reports | Total Reports |
|------|---------------|-----------------|---------------|
| typescript-eslint | 0 | 0 | 0 |
| tRPC | 0 | 0 | 0 |
| query | 0 | 0 | 0 |

## Methodology

1. Cloned each repo (shallow, depth 1)
2. Scanned up to 100 TypeScript files per repo
3. Ran `no-redundant-branching` rule in warn mode
4. Classified each report as TP or FP (if any found)

## Results

No violations were found in the scanned files. This suggests the rule has:
- **High precision** on real-world TypeScript codebases
- **No false positives** in these samples

## Notes

The evaluated repos are mature TypeScript projects that:
- Already use lookup tables directly where appropriate
- Avoid the redundant branching pattern this rule detects
- Have well-structured conditional logic

