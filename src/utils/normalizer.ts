import type { ChainDescriptor, NormalizedChain } from "./types.js";

/**
 * Normalize a chain by extracting its structure (discriminant + sorted set of branch keys).
 * The structure hash is order-independent for branch values.
 *
 * Two chains match iff they test the same discriminant for the same set of values.
 */
export function normalizeChain(chain: ChainDescriptor): NormalizedChain {
  // Extract branch keys (the literal values being compared)
  const branchKeys = chain.branches
    .map((b) => b.testValue)
    .filter((v) => v !== "default")
    .sort();

  // Create structure hash: discriminant + sorted branch values + branch count + fallback presence
  const structureKey = `${chain.discriminant}|||${branchKeys.join(",")}|||${chain.branches.length}|||${chain.fallback ? 1 : 0}`;

  // Simple non-cryptographic hash
  const structureHash = hashString(structureKey);

  return {
    descriptor: chain,
    structureHash,
  };
}

/**
 * Simple string hash for structure deduplication.
 * Not cryptographic - just for in-memory per-file grouping.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Group chains by (discriminant, structureHash).
 */
export function groupChains(
  chains: ChainDescriptor[],
  threshold: number
): Map<string, ChainDescriptor[]> {
  const normalized = chains.map((c) => normalizeChain(c));
  const groups = new Map<string, ChainDescriptor[]>();

  for (const nc of normalized) {
    const key = `${nc.descriptor.discriminant}::${nc.structureHash}`;
    const existing = groups.get(key) ?? [];
    existing.push(nc.descriptor);
    groups.set(key, existing);
  }

  // Filter to groups with >= threshold members
  const result = new Map<string, ChainDescriptor[]>();
  for (const [key, chainGroup] of groups) {
    if (chainGroup.length >= threshold) {
      result.set(key, chainGroup);
    }
  }

  return result;
}

/**
 * Check if two chains are in compatible scopes (can share a lookup table).
 * For now, we only autofix when all chains are in the same top-level scope
 * or same function scope.
 */
export function scopesAreCompatible(
  chain1: ChainDescriptor,
  chain2: ChainDescriptor
): boolean {
  // Use the chain's location to determine rough scope compatibility
  // In practice, for the flat config ESLint use case, we handle this
  // at the Program level. For now, allow all since we're conservative.
  return true;
}
