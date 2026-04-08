# Scientific Evaluation Report: eslint-plugin-redundant-branching

**Date:** 2026-04-08  
**Protocol:** Pre-registered observational cross-sectional study  
**Plugin version:** 0.0.1 (commit fe219d9)

---

## 1. Research Questions

- **RQ1:** Does AI-generated code naturally contain redundant branching patterns?
- **RQ2:** How does prevalence compare between AI-generated and human-written code?
- **RQ3:** Is the plugin's detection precision acceptable for production use?

---

## 2. Methodology

### 2.1 AI Code Generation (Treatment Group)

- **Models:** Claude (claude-sonnet-4-20250514 via worker agent), GPT-4o (via openai/gpt-4o)
- **Prompts:** 30 non-leading prompts across 3 opportunity tiers:
  - **High (H01–H10):** Tasks that naturally require categorical → multi-value resolution (e.g., "map HTTP status codes to info objects")
  - **Medium (M11–M20):** Tasks where the pattern might or might not appear (e.g., "validate form fields", "state machine")
  - **Low (L21–L30):** Algorithmic tasks unlikely to produce the pattern (e.g., "binary search", "levenshtein distance")
- **System prompt:** "You are a TypeScript developer. Write a single TypeScript file implementing the requested functionality. Include type definitions and exports."
- **Forbidden words in prompts:** `if`, `else`, `switch`, `case`, `ternary`, `conditional`, `branch`, `lookup`, `map` (as noun), `table`, `dictionary`, `enum`
- **Total AI files:** 60 (30 prompts × 2 models)

### 2.2 Human Code Collection (Control Group)

- **Source:** 15 GitHub TypeScript repositories across quality tiers
- **Sampling:** Random sample (sort -R | head -300) per repo
- **Exclusions:** node_modules, dist, tests, .d.ts, config files
- **Total human files:** 4,196

| Tier | Repos | Rationale |
|------|-------|-----------|
| Elite OSS | TypeScript, next.js, remix | Heavily reviewed, large teams |
| Good UI/Util | mantine, chakra-ui, primitives, zod | Component/validation libraries |
| Real Apps | cal.com, excalidraw, slate, nocodb | Production apps with business logic |
| Smaller/AI-assisted | dub, create-t3-app, lobe-chat, AFFiNE | Newer, faster-moving, possibly AI-assisted |

---

## 3. Results

### 3.1 AI-Generated Code

| Model | Files | Files with Detections | Total Detections | Prevalence |
|-------|-------|-----------------------|------------------|------------|
| Claude | 30 | **0** | 0 | **0.0%** |
| GPT-4o | 30 | **0** | 0 | **0.0%** |
| **Combined** | **60** | **0** | **0** | **0.0%** |

**By prompt opportunity tier:**

| Tier | Files | Detections | Prevalence |
|------|-------|------------|------------|
| High (H01–H10) | 20 | 0 | 0.0% |
| Medium (M11–M20) | 20 | 0 | 0.0% |
| Low (L21–L30) | 20 | 0 | 0.0% |

**Key observation:** Both Claude and GPT-4o independently chose to use `Record<>` / lookup table patterns for ALL high-opportunity prompts. Neither model produced redundant conditional chains. The pattern the plugin detects is the *anti-pattern* that these models naturally avoid.

### 3.2 Human-Written Code

| Repo | Tier | Files | Detections | Files w/ Detections | Prevalence |
|------|------|-------|------------|---------------------|------------|
| TypeScript | Elite | 300 | 0 | 0 | 0.0% |
| next.js | Elite | 300 | 0 | 0 | 0.0% |
| remix | Elite | 300 | 2 | 1 | 0.3% |
| mantine | Good UI | 300 | 0 | 0 | 0.0% |
| chakra-ui | Good UI | 300 | 0 | 0 | 0.0% |
| primitives | Good UI | 223 | 10 | 5 | 2.2% |
| zod | Good Util | 223 | 13 | 5 | 2.2% |
| cal.com | Real App | 300 | 0 | 0 | 0.0% |
| excalidraw | Real App | 300 | 13 | 5 | 1.7% |
| slate | Real App | 300 | 0 | 0 | 0.0% |
| nocodb | Real App | 300 | 6 | 2 | 0.7% |
| dub | Smaller | 300 | 0 | 0 | 0.0% |
| create-t3-app | Smaller | 150 | 0 | 0 | 0.0% |
| lobe-chat | AI-assisted | 300 | 2 | 1 | 0.3% |
| AFFiNE | AI-assisted | 300 | 0 | 0 | 0.0% |
| **TOTAL** | — | **4,196** | **46** | **19** | **0.45%** |

### 3.3 Detection Examples (Human Code)

**excalidraw** — `startHeading` discriminant (4 chains):
```
Lines 1933, 1960, 1986, 2012: 4 conditional chains on 'startHeading'
```

**primitives** — `align` discriminant (repeated across components):
```
Multiple UI components testing 'align' for positioning calculations
```

**zod** — `schemaType` and `iss.code` discriminants:
```
Schema validation logic with parallel type checks
```

---

## 4. Statistical Analysis

### 4.1 Primary Hypothesis Test

**H₀:** p_AI = p_human (same prevalence)  
**H₁:** p_AI > p_human (AI has higher prevalence)

| | ≥1 Detection | 0 Detections | Total |
|---|---|---|---|
| AI files | 0 | 60 | 60 |
| Human files | 19 | 4,177 | 4,196 |

**Fisher's exact test (one-sided, H₁: p_AI > p_human):**
- p-value = 1.000
- **Result: FAIL TO REJECT H₀**

The data does not support the hypothesis that AI-generated code has higher prevalence of redundant branching than human code. In fact, the direction is reversed — human code has detections while AI code has none.

### 4.2 Confidence Intervals (Clopper-Pearson exact, 95%)

| Group | Prevalence | 95% CI |
|-------|------------|--------|
| AI-generated | 0/60 = 0.0% | [0.0%, 6.0%] |
| Human-written | 19/4196 = 0.45% | [0.27%, 0.71%] |

### 4.3 Effect Size

- **Cohen's h:** Not applicable (AI rate = 0%, direction opposite to hypothesized)
- **Odds ratio:** 0 (AI has lower prevalence than human)

---

## 5. Hypothesis Assessment

### Pre-registered outcomes:

| Outcome | Criteria | Result |
|---------|----------|--------|
| **STRONG POSITIVE** | AI ≥ 8%, human < 1%, p < 0.01, precision ≥ 80% | ❌ **NOT MET** |
| **MODERATE POSITIVE** | AI ≥ 3%, human < 1%, p < 0.05, precision ≥ 70% | ❌ **NOT MET** |
| **WEAK SIGNAL** | AI > 0%, Fisher p in [0.05, 0.10] | ❌ **NOT MET** |
| **NULL RESULT** | AI ≤ 1% AND human ≈ 0%, Fisher p > 0.10 | ⚠️ **PARTIALLY MET** |
| **PRECISION FAILURE** | Precision < 60% | ❓ **NEEDS VERIFICATION** |

**Actual outcome: REVERSED HYPOTHESIS**

The pattern exists in human code (0.45%) but NOT in AI-generated code (0.0%). This is the opposite of what was hypothesized.

---

## 6. Discussion

### 6.1 Why AI Code Doesn't Produce the Pattern

Both Claude and GPT-4o independently chose `Record<Type, Config>` patterns for categorical lookups. Modern LLMs have been trained on sufficient high-quality code to recognize that lookup tables are superior to repeated conditionals. The models naturally produce the *solution* that the plugin recommends, not the *anti-pattern* it detects.

This fundamentally undermines the plugin's stated motivation:
> "AI models generate code where the same branching logic is repeated multiple times with different leaf values."

This claim is **not supported** by the evidence. At least for current-generation models (Claude Sonnet 4, GPT-4o), AI-generated code does not exhibit this pattern.

### 6.2 Why Human Code DOES Produce the Pattern

The 0.45% prevalence in human code, while low, is non-zero. Detections appeared in:
- **UI component libraries** (primitives: `align` prop handling)
- **Complex applications** (excalidraw: geometric calculations with `side`/`startHeading`)
- **Validation libraries** (zod: schema type discrimination)

These are cases where human developers wrote parallel conditional chains organically — often across separate functions or code sections that evolved independently.

### 6.3 Implications

1. **The plugin's value proposition needs repositioning.** It is NOT an "AI slop detector." It is a general code quality tool that detects a specific structural anti-pattern in human-written code.

2. **The pattern is rare** (0.45% of files) but appears in respected, well-maintained projects. This suggests it's a genuine code quality issue that even good developers occasionally produce.

3. **Detection precision needs verification.** The 46 detections in human code should be manually reviewed to determine TP/FP rates.

---

## 7. Threats to Validity

| Threat | Assessment |
|--------|------------|
| **Prompt bias** | Mitigated: Non-leading prompts, forbidden word list. However, the system prompt says "TypeScript developer" which may bias toward higher-quality patterns. |
| **Model selection** | Only 2 models tested. Smaller/older models (GPT-3.5, Claude Haiku) or code-specific models (Codex) might produce different results. |
| **Sample size** | 60 AI files is small. Upper bound of 95% CI is 6.0%, meaning we cannot rule out up to 6% AI prevalence. |
| **Human corpus bias** | All repos are public, popular, and maintained. Less-maintained code might have higher prevalence. |
| **Single rater** | TP/FP classification not yet performed. |
| **Temporal validity** | The @thekitze example that motivated the plugin may have come from an older model or a specific prompting style not tested here. |

---

## 8. Conclusion

### Verdict: NULL RESULT (with reversed direction)

**The hypothesis that AI-generated code contains more redundant branching than human code is not supported.** The data shows the opposite: 0% AI prevalence vs 0.45% human prevalence.

However, the plugin is NOT useless:
- It detects a real pattern in well-maintained human codebases (excalidraw, zod, radix-ui/primitives)
- The pattern is rare but genuine
- The detections in human code warrant manual TP/FP review

### Recommendation

1. **Remove "AI slop" framing** from the README and marketing
2. **Reposition as a general code quality tool** that detects structural redundancy
3. **Verify precision** by manually reviewing the 46 human-code detections
4. **Consider testing with older/smaller models** that may behave differently
5. **The plugin has value** — but its value is in catching human-written redundancy, not AI-generated redundancy

---

## 9. Raw Data

- AI corpus: `experiment/ai-corpus/` (60 files)
- Human corpus: `experiment/human-corpus/` (4,196 files from 15 repos)
- Prompts: `experiment/prompts.json`
- Human corpus manifest: `experiment/results/human-corpus-manifest.tsv`

---

## 10. Reproducibility

```bash
# Build plugin
npm run build

# Generate AI corpus (requires API keys for Claude + GPT-4o)
# Files in experiment/ai-corpus/ai-{model}-{promptId}.ts

# Collect human corpus
bash experiment/scripts/collect-human-corpus.sh

# Run analysis
cd experiment/ai-corpus && npx eslint . --format json
cd experiment/human-corpus && npx eslint {repo}/ --format json
```
