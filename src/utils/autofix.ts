/* eslint-disable no-unused-vars */
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type * as types from "@typescript-eslint/types";
import type { AutofixResult, ChainDescriptor } from "./types.js";

/**
 * Convert a canonical key (format: "type:value") to a JavaScript literal.
 * Returns null if the key is not a valid canonical key.
 */
function canonicalKeyToLiteral(key: string): string | null {
  const colonIndex = key.indexOf(":");
  if (colonIndex === -1) return null;
  
  const type = key.slice(0, colonIndex);
  const value = key.slice(colonIndex + 1);
  
  switch (type) {
    case "string":
      return JSON.stringify(value);
    case "number":
      // Validate it's a valid number
      if (!isFinite(Number(value))) return null;
      return value;
    case "bigint":
      return `${value}n`;
    case "boolean":
      if (value === "true") return "true";
      if (value === "false") return "false";
      return null;
    case "null":
      return "null";
    default:
      return null;
  }
}

/**
 * Check if a node contains any potentially unsafe side effects
 * that would make lookup table extraction unsafe.
 * 
 * SAFETY PRINCIPLE: Deny-by-default. Unknown node types are considered unsafe.
 * Only explicitly whitelisted node types are considered safe.
 */
function hasUnsafeSideEffects(node: types.TSESTree.Node): boolean {
  const nodeType = node.type;

  // === WHITELIST: Known safe node types (no side effects) ===
  switch (nodeType) {
    case AST_NODE_TYPES.Identifier:
    case AST_NODE_TYPES.Literal:
    case AST_NODE_TYPES.ThisExpression:
    case AST_NODE_TYPES.Super:
    case AST_NODE_TYPES.MetaProperty:
    case AST_NODE_TYPES.JSXNamespacedName:
    case AST_NODE_TYPES.JSXIdentifier:
      return false;
    default:
      break;
  }

  // === BLACKLIST: Known unsafe node types (definitely have side effects) ===
  switch (nodeType) {
    case AST_NODE_TYPES.CallExpression:
    case AST_NODE_TYPES.NewExpression:
    case AST_NODE_TYPES.AwaitExpression:
    case AST_NODE_TYPES.YieldExpression:
    case AST_NODE_TYPES.AssignmentExpression:
    case AST_NODE_TYPES.UpdateExpression:
    case AST_NODE_TYPES.TaggedTemplateExpression:
    case AST_NODE_TYPES.ImportExpression:
    case AST_NODE_TYPES.ChainExpression: // Optional chaining can trigger getters with side effects
      return true;
    default:
      break;
  }

  // === RECURSIVE CASES: Check children ===
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
      // delete operator has side effects
      if (unary.operator === "delete") return true;
      // typeof, void, !, -, +, ~, etc. are safe if operand is safe
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
      // Member access like obj.prop is generally safe, but optional chaining
      // is handled above as ChainExpression
      return false;
    case AST_NODE_TYPES.TemplateLiteral: {
      const tmpl = node as types.TSESTree.TemplateLiteral;
      return tmpl.expressions.some((e) => hasUnsafeSideEffects(e));
    }
    case AST_NODE_TYPES.ExpressionStatement: {
      const stmt = node as types.TSESTree.ExpressionStatement;
      return hasUnsafeSideEffects(stmt.expression);
    }
    case AST_NODE_TYPES.ReturnStatement: {
      const ret = node as types.TSESTree.ReturnStatement;
      return ret.argument ? hasUnsafeSideEffects(ret.argument) : false;
    }
    // === DENY BY DEFAULT: Unknown node types are unsafe ===
    default:
      return true;
  }
}

/**
 * Get source text for a node.
 */
function getSourceText(
  node: types.TSESTree.Node,
  sourceCode: { getSource: (...args: [types.TSESTree.Node]) => string }
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameExists(name: string, sourceText: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  return pattern.test(sourceText);
}

function uniqueName(baseName: string, sourceText: string): string {
  if (!nameExists(baseName, sourceText)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName}_${suffix}`;
  while (nameExists(candidate, sourceText)) {
    suffix++;
    candidate = `${baseName}_${suffix}`;
  }

  return candidate;
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
  sourceCode: { getSource: (...args: [types.TSESTree.Node]) => string }
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
  sourceCode: { getSource: (...args: [types.TSESTree.Node]) => string },
  sourceText: string
): AutofixResult | null {
  if (chains.length === 0) return null;

  const firstChain = chains[0]!;
  const discriminant = firstChain.discriminant;
  const sanitizedDiscriminant = sanitizeVarName(discriminant);
  const baseLookupName = `_${sanitizedDiscriminant}_LOOKUP`;
  const baseDefaultName = `_${sanitizedDiscriminant}_DEFAULT`;

  let lookupName = baseLookupName;
  let defaultName = baseDefaultName;

  if (nameExists(baseLookupName, sourceText) || nameExists(baseDefaultName, sourceText)) {
    let suffix = 2;
    let lookupCandidate = `${baseLookupName}_${suffix}`;
    let defaultCandidate = `${baseDefaultName}_${suffix}`;

    while (nameExists(lookupCandidate, sourceText) || nameExists(defaultCandidate, sourceText)) {
      suffix++;
      lookupCandidate = `${baseLookupName}_${suffix}`;
      defaultCandidate = `${baseDefaultName}_${suffix}`;
    }

    lookupName = uniqueName(lookupCandidate, sourceText);
    defaultName = uniqueName(defaultCandidate, sourceText);
  }

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
      // Convert canonical key to proper JS literal, or use as-is if not canonical
      const keyLiteral = canonicalKeyToLiteral(entry.key) ?? JSON.stringify(entry.key);
      return `  ${keyLiteral}: { ${objProps} }`;
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
