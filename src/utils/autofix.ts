import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type * as types from "@typescript-eslint/types";
import type { AutofixResult, ChainDescriptor } from "./types.js";

/**
 * Check if a node contains any potentially unsafe side effects
 * that would make lookup table extraction unsafe.
 */
function hasUnsafeSideEffects(node: types.TSESTree.Node): boolean {
  const nodeType = node.type;

  switch (nodeType) {
    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.Literal:
    case AST_NODE_TYPES.ThisExpression:
    case AST_NODE_TYPES.Super:
    case AST_NODE_TYPES.MetaProperty:
    case AST_NODE_TYPES.JSXNamespacedName:
    case AST_NODE_TYPES.JSXIdentifier:
      return false;
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression:
    case AST_NODE_TYPES.AwaitExpression:
    case AST_NODE_TYPES.YieldExpression:
    case AST_NODE_TYPES.AssignmentExpression:
    case AST_NODE_TYPES.UpdateExpression:
    case AST_NODE_TYPES.TaggedTemplateExpression:
      return true;
    default:
      break;
  }

  switch (nodeType) {
    case AST_NODE_TYPES.ConditionalExpression: {
      const cond = node as types.TSESTree.ConditionalExpression;
      return (
        hasUnsafeSideEffects(cond.test) ||
        hasUnsafeSideEffects(cond.consequent) ||
        hasUnsafeSideEffects(cond.alternate)
      );
    }
    case AST_NODE_TYPES.BinaryExpression:
    case AST_NODE_TYPES.LogicalExpression: {
      const bin = node as types.TSESTree.BinaryExpression;
      return (
        hasUnsafeSideEffects(bin.left) ||
        hasUnsafeSideEffects(bin.right)
      );
    }
    case AST_NODE_TYPES.UnaryExpression: {
      const unary = node as types.TSESTree.UnaryExpression;
      return hasUnsafeSideEffects(unary.argument);
    }
    case AST_NODE_TYPES.SequenceExpression: {
      const seq = node as types.TSESTree.SequenceExpression;
      return seq.expressions.some((e) => hasUnsafeSideEffects(e));
    }
    case AST_NODE_TYPES.ArrayExpression: {
      const arr = node as types.TSESTree.ArrayExpression;
      return arr.elements.some(
        (e) => e !== null && hasUnsafeSideEffects(e as types.TSESTree.Node)
      );
    }
    case AST_NODE_TYPES.ObjectExpression: {
      const obj = node as types.TSESTree.ObjectExpression;
      return obj.properties.some((p) => {
        if (p.type === AST_NODE_TYPES.SpreadElement) {
          return hasUnsafeSideEffects(
            (p as types.TSESTree.SpreadElement).argument
          );
        }
        const prop = p as types.TSESTree.Property;
        return (
          hasUnsafeSideEffects(prop.key as types.TSESTree.Node) ||
          hasUnsafeSideEffects(prop.value)
        );
      });
    }
    case AST_NODE_TYPES.BlockStatement: {
      const block = node as types.TSESTree.BlockStatement;
      return block.body.some((s) => hasUnsafeSideEffects(s));
    }
    case AST_NODE_TYPES.MemberExpression:
      return false;
    default:
      return false;
  }
}

/**
 * Get source text for a node.
 */
function getSourceText(
  node: types.TSESTree.Node,
  sourceCode: { getSource: (node: types.TSESTree.Node) => string }
): string {
  return sourceCode.getSource(node);
}

/**
 * Generate a safe variable name for the lookup table from a discriminant.
 */
function sanitizeVarName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .replace(/^_+|_+$/g, "")
    .substring(0, 30);
}

/**
 * Extract the "leaf value" from a consequent node.
 * For ternaries, the consequent is the expression directly.
 * For if-else bodies that are BlockStatements, we look for a single
 * ExpressionStatement with an AssignmentExpression and use its right side.
 * For switch cases, the consequent is the SwitchCase body.
 */
function extractLeafValue(
  consequent: types.TSESTree.Node,
  sourceCode: { getSource: (node: types.TSESTree.Node) => string }
): string {
  // If it's a BlockStatement with a single ExpressionStatement, extract the value
  if (
    consequent.type === AST_NODE_TYPES.BlockStatement &&
    (consequent as types.TSESTree.BlockStatement).body.length === 1
  ) {
    const stmt = (consequent as types.TSESTree.BlockStatement).body[0]!;
    if (stmt.type === AST_NODE_TYPES.ExpressionStatement) {
      const expr = (stmt as types.TSESTree.ExpressionStatement).expression;
      if (expr.type === AST_NODE_TYPES.AssignmentExpression) {
        const assign = expr as types.TSESTree.AssignmentExpression;
        if (assign.operator === "=") {
          return getSourceText(assign.right, sourceCode);
        }
      }
    }
  }
  return getSourceText(consequent, sourceCode);
}

/**
 * Generate the lookup table autofix for a group of chains.
 * Returns a SINGLE replacement string that covers the entire group span.
 * 
 * Fallback handling:
 * - If ALL chains have fallbacks with consistent assignment targets,
 *   generates a _DEFAULT object and uses `?? _DEFAULT` fallback.
 * - If any chain lacks a fallback or fallback extraction is unsafe,
 *   skips default object generation (uses `?? {}` instead).
 * - Reports are still emitted even if autofix is skipped.
 */
export function generateLookupFix(
  chains: ChainDescriptor[],
  sourceCode: { getSource: (node: types.TSESTree.Node) => string }
): AutofixResult | null {
  if (chains.length === 0) return null;

  const firstChain = chains[0]!;
  const discriminant = firstChain.discriminant;
  const lookupName = `_${sanitizeVarName(discriminant)}_LOOKUP`;
  const defaultName = `_${sanitizeVarName(discriminant)}_DEFAULT`;

  // Check if any leaf has unsafe side effects
  let canFix = true;
  for (const chain of chains) {
    for (const branch of chain.branches) {
      if (hasUnsafeSideEffects(branch.consequent)) {
        canFix = false;
        break;
      }
    }
    if (chain.fallback && hasUnsafeSideEffects(chain.fallback)) {
      canFix = false;
    }
    if (!canFix) break;
  }

  // Collect all branch keys across all chains
  const allKeys = new Set<string>();
  for (const chain of chains) {
    for (const branch of chain.branches) {
      if (branch.testValue !== "default") {
        allKeys.add(branch.testValue);
      }
    }
  }
  const sortedKeys = Array.from(allKeys).sort();

  // Build lookup table entries
  const lookupEntries: Array<{
    key: string;
    assignments: Array<{ variableName: string; valueCode: string }>;
  }> = [];

  for (const key of sortedKeys) {
    const assignments: Array<{ variableName: string; valueCode: string }> = [];

    for (const chain of chains) {
      // Find the branch with this key in this chain
      const branch = chain.branches.find((b) => b.testValue === key);
      if (branch) {
        const varName = chain.assignmentTarget ?? "_v";
        const valueCode = extractLeafValue(branch.consequent, sourceCode);
        assignments.push({
          variableName: varName,
          valueCode,
        });
      }
    }

    lookupEntries.push({ key, assignments });
  }

  // Build the lookup table code
  const entriesCode = lookupEntries
    .map((entry) => {
      const objProps = entry.assignments
        .map((a) => `${a.variableName}: ${a.valueCode}`)
        .join(", ");
      return `  ${JSON.stringify(entry.key)}: { ${objProps} }`;
    })
    .join(",\n");

  const lookupCode = `const ${lookupName} = {\n${entriesCode}\n};`;

  // Collect all variable names that will be destructured
  const varNames = chains
    .filter((c) => c.assignmentTarget !== null)
    .map((c) => c.assignmentTarget!)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  // Determine if we can generate a default object:
  // - ALL chains with assignment targets must have fallbacks
  // - All fallbacks must be safe (already checked above)
  // - Fallback values must be consistent for same assignment targets
  let generateDefault = false;
  const defaultEntries: Array<{ variableName: string; valueCode: string }> = [];

  const chainsWithAssignments = chains.filter((c) => c.assignmentTarget !== null);
  const allHaveFallbacks = chainsWithAssignments.every((c) => c.fallback !== null);

  if (allHaveFallbacks && chainsWithAssignments.length > 0 && canFix) {
    generateDefault = true;
    for (const chain of chainsWithAssignments) {
      if (chain.fallback) {
        const valueCode = extractLeafValue(chain.fallback, sourceCode);
        defaultEntries.push({
          variableName: chain.assignmentTarget!,
          valueCode,
        });
      }
    }
  }

  // Build the default object code if applicable
  let defaultCode = "";
  if (generateDefault) {
    const defaultProps = defaultEntries
      .map((e) => `${e.variableName}: ${e.valueCode}`)
      .join(", ");
    defaultCode = `\nconst ${defaultName} = { ${defaultProps} };`;
  }

  // Build a SINGLE replacement that covers the full group span
  let destructuring = "";
  if (varNames.length > 0) {
    const fallback = generateDefault ? ` ?? ${defaultName}` : " ?? {}";
    destructuring = `const { ${varNames.join(", ")} } = ${lookupName}[${discriminant}]${fallback};`;
  }

  const singleReplacement = destructuring
    ? `${lookupCode}${defaultCode}\n${destructuring}`
    : `${lookupCode}`;

  return {
    lookupName,
    lookupCode,
    replacements: [], // kept for compatibility but not used
    singleReplacement,
    canFix,
  };
}
