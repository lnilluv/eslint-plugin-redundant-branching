import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type * as types from "@typescript-eslint/types";
import type { DiscriminantInfo } from "./types.js";

/**
 * Returns true if the node is a literal value (string, number, boolean, null).
 */
export function isLiteralValue(node: types.TSESTree.Node): boolean {
  // All literal sub-types have type === AST_NODE_TYPES.Literal via LiteralBase
  if ((node as types.TSESTree.Literal).type === AST_NODE_TYPES.Literal) {
    return true;
  }
  return false;
}

/**
 * Serializes a node to a placeholder string when source is unavailable.
 */
function getSource(node: types.TSESTree.Node): string {
  return `__source_${node.range?.[0] ?? 0}_${node.range?.[1] ?? 0}__`;
}

/**
 * Serializes a member expression or identifier to a dot-notation string.
 */
function serializeNode(node: types.TSESTree.Node): string {
  switch (node.type) {
    case "Identifier":
      return (node as types.TSESTree.Identifier).name;
    case "MemberExpression": {
      const mem = node as types.TSESTree.MemberExpression;
      const obj = serializeNode(mem.object);
      if (mem.computed) {
        if (
          mem.property.type === "Identifier" ||
          mem.property.type === "Literal"
        ) {
          const prop =
            mem.property.type === "Identifier"
              ? (mem.property as types.TSESTree.Identifier).name
              : String((mem.property as types.TSESTree.Literal).value);
          return `${obj}.${prop}`;
        }
      }
      const prop =
        mem.property.type === "Identifier"
          ? (mem.property as types.TSESTree.Identifier).name
          : null;
      if (prop !== null && !mem.computed) {
        return `${obj}.${prop}`;
      }
      return getSource(node);
    }
    case "ThisExpression":
      return "this";
    default:
      return getSource(node);
  }
}

/**
 * Get string value of a literal node.
 * @deprecated Use getLiteralCanonicalKey instead to preserve type information
 */
export function getLiteralValue(node: types.TSESTree.Node): string {
  const lit = node as types.TSESTree.Literal;
  return String(lit.value);
}

/**
 * Get a canonical key for a literal that includes type information.
 * This ensures '1', 1, and 1n are treated as different values.
 * Format: "type:value" where type is 'string', 'number', 'bigint', 'boolean', or 'null'
 */
export function getLiteralCanonicalKey(node: types.TSESTree.Node): string | null {
  if (!isLiteralValue(node)) {
    return null;
  }
  const lit = node as types.TSESTree.Literal;
  const value = lit.value;
  
  if (value === null) {
    return "null:null";
  }
  
  const type = typeof value;
  if (type === "string") {
    return `string:${value}`;
  }
  if (type === "number") {
    return `number:${value}`;
  }
  if (type === "bigint") {
    return `bigint:${value.toString()}`;
  }
  if (type === "boolean") {
    return `boolean:${value}`;
  }
  
  // Unknown type - treat as unsafe
  return null;
}

/**
 * Extract discriminant and value from a binary equality expression.
 * Handles both `x === 'lit'` and `'lit' === x` (reversed comparisons).
 * Returns null for non-equality ops, or when both sides are literals.
 */
export function extractDiscriminant(
  node: types.TSESTree.BinaryExpression
): DiscriminantInfo | null {
  if (node.operator !== "===") {
    return null;
  }

  const { left, right } = node;

  const leftIsLiteral = isLiteralValue(left);
  const rightIsLiteral = isLiteralValue(right);

  if (leftIsLiteral && rightIsLiteral) {
    return null;
  }

  if (!leftIsLiteral && !rightIsLiteral) {
    return null;
  }

  if (!leftIsLiteral && rightIsLiteral) {
    const discriminantText = serializeNode(left);
    const valueText = getLiteralCanonicalKey(right);
    if (valueText === null) return null;
    return { discriminant: discriminantText, value: valueText, node };
  }

  if (leftIsLiteral && !rightIsLiteral) {
    const discriminantText = serializeNode(right);
    const valueText = getLiteralCanonicalKey(left);
    if (valueText === null) return null;
    return { discriminant: discriminantText, value: valueText, node };
  }

  return null;
}
