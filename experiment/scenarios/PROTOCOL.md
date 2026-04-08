# Mimicry Evaluation Protocol

## Core Hypothesis

AI models propagate redundant branching when existing code already contains
the pattern. The anti-pattern accumulates through incremental coding, not
single-shot generation.

## Three Scenarios

### Scenario A: Style Mimicry (Context Contamination)

Provide a file that already has ONE conditional chain. Ask the model to add
another property derived from the same discriminant. Measure whether it:
- (a) Adds another chain matching the existing style → PROPAGATION
- (b) Refactors into a lookup table → REFACTOR
- (c) Uses a different approach entirely → OTHER

### Scenario B: Incremental Multi-Turn

Simulate a conversation where properties are requested one at a time:
- Turn 1: "I need a title based on status"
- Turn 2: "Now add a label for the same statuses"
- Turn 3: "Now add a description too"

Measure whether redundant chains accumulate across turns.

### Scenario C: Vibe-Coding Completion

Provide a partial file with a cursor position after existing chains.
The file already has 2+ chains on the same discriminant.
Ask the model to "continue implementing" or "add icon support."

## Models Under Test

1. Claude Sonnet 4 (worker default) — frontier
2. GPT-4o — frontier
3. GPT-4o-mini — popular for fast coding / vibe-coding

## Classification

For each output, classify:
- PROPAGATION: Model added another conditional chain on the same discriminant
- REFACTOR: Model consolidated existing + new into a lookup table
- OTHER: Different approach (separate function, enum, etc.)

## Success Criteria

If propagation rate across all scenarios and models is:
- ≥40%: Strong evidence — plugin addresses a real AI-assisted coding problem
- 20-39%: Moderate evidence — pattern emerges in some workflows
- 5-19%: Weak signal — pattern is uncommon even in realistic scenarios
- <5%: Null result — modern AI avoids the pattern even with mimicry pressure
