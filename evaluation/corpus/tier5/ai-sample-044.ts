// Synthetic AI sample #044
// Pattern: object lookup control (expected no detection)

type Item = { label: string; color: string; score: number };

const ITEM_MAP: Record<string, Item> = {
  alpha: { label: 'Alpha', color: 'blue', score: 10 },
  beta: { label: 'Beta', color: 'purple', score: 20 },
  gamma: { label: 'Gamma', color: 'green', score: 30 }
};

export function lookupValue044(kind: string): Item {
  return ITEM_MAP[kind] ?? { label: 'Other', color: 'gray', score: 0 };
}
