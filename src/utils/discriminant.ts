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
 */
export function getLiteralValue(node: types.TSESTree.Node): string {
  const lit = node as types.TSESTree.Literal;
  return String(lit.value);
}

/**
 * Extract discriminant and value from a binary equality expression.
 * Handles both `x === 'lit'` and `'lit' === x` (reversed comparisons).
 * Returns null for non-equality ops, or when both sides are literals.
 */
export function extractDiscriminant(
  node: types.TSESTree.BinaryExpression
): DiscriminantInfo | null {
  if (
    node.operator !== "===" &&
    node.operator !== "==" &&
    node.operator !== "!==" &&
    node.operator != "!="
  ) {
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
    const valueText = getLiteralValue(right);
    return { discriminant: discriminantText, value: valueText, node };
  }

  if (leftIsLiteral && !rightIsLiteral) {
    const discriminantText = serializeNode(right);
    const valueText = getLiteralValue(left);
    return { discriminant: discriminantText, value: valueText, node };
  }

  return null;
}
