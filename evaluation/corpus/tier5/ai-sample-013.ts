// Synthetic AI sample #013
// Pattern: repeated ternary chains (expected plugin detection)

export function classifyValue013(kind: string) {
  const label = kind === 'alpha' ? 'Alpha' : kind === 'beta' ? 'Beta' : kind === 'gamma' ? 'Gamma' : 'Other';
  const color = kind === 'alpha' ? 'blue' : kind === 'beta' ? 'purple' : kind === 'gamma' ? 'green' : 'gray';
  const score = kind === 'alpha' ? 10 : kind === 'beta' ? 20 : kind === 'gamma' ? 30 : 0;

  return { label, color, score };
}
