/* eslint-disable no-unused-vars */
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type * as types from "@typescript-eslint/types";
import type { Branch, ChainDescriptor } from "./types.js";
import { extractDiscriminant, getLiteralCanonicalKey, isLiteralValue } from "./discriminant.js";

export interface ChainExtractorResult {
  descriptor: ChainDescriptor | null;
  scopeId: string;
  assignmentTarget: string | null;
}

function getSourceText(
  node: types.TSESTree.Node,
  sourceCode: { getSource: (_node: types.TSESTree.Node) => string }
): string {
  return sourceCode.getSource(node);
}

function getNodeDiscriminant(left: types.TSESTree.Node, right: types.TSESTree.Node): types.TSESTree.Node {
  const leftIsLit = (left as types.TSESTree.Literal).type === AST_NODE_TYPES.Literal;
  return leftIsLit ? right : left;
}

function getReturnStatementAndObject(
  consequent: types.TSESTree.Statement
): { returnStatement: types.TSESTree.ReturnStatement; objectExpression: types.TSESTree.ObjectExpression } | null {
  if (consequent.type === AST_NODE_TYPES.ReturnStatement) {
    const ret = consequent as types.TSESTree.ReturnStatement;
    if (ret.argument?.type === AST_NODE_TYPES.ObjectExpression) {
      return {
        returnStatement: ret,
        objectExpression: ret.argument as types.TSESTree.ObjectExpression,
      };
    }
    return null;
  }

  if (consequent.type === AST_NODE_TYPES.BlockStatement) {
    const block = consequent as types.TSESTree.BlockStatement;
    if (block.body.length !== 1) {
      return null;
    }

    const onlyStmt = block.body[0];
    if (onlyStmt?.type !== AST_NODE_TYPES.ReturnStatement) {
      return null;
    }

    const ret = onlyStmt as types.TSESTree.ReturnStatement;
    if (ret.argument?.type === AST_NODE_TYPES.ObjectExpression) {
      return {
        returnStatement: ret,
        objectExpression: ret.argument as types.TSESTree.ObjectExpression,
      };
    }
  }

  return null;
}

function getObjectKeySignature(obj: types.TSESTree.ObjectExpression): string | null {
  const keys: string[] = [];

  for (const prop of obj.properties) {
    if (prop.type === AST_NODE_TYPES.SpreadElement) {
      return null;
    }

    if (prop.type !== AST_NODE_TYPES.Property) {
      return null;
    }

    const property = prop as types.TSESTree.Property;
    if (property.computed) {
      return null;
    }

    if (property.key.type === AST_NODE_TYPES.Identifier) {
      keys.push((property.key as types.TSESTree.Identifier).name);
      continue;
    }

    if (property.key.type === AST_NODE_TYPES.Literal) {
      const literalKey = (property.key as types.TSESTree.Literal).value;
      if (typeof literalKey === "string" || typeof literalKey === "number") {
        keys.push(String(literalKey));
        continue;
      }
    }

    return null;
  }

  return keys.sort().join("|");
}

/**
 * Extract a ternary chain from a ConditionalExpression.
 */
export function extractTernaryChain(
  node: types.TSESTree.ConditionalExpression,
  sourceCode: { getSource: (_node: types.TSESTree.Node) => string }
): ChainExtractorResult {
  interface TernaryBranch {
    test: types.TSESTree.Node;
    testCode: string;
    testValue: string;
    consequent: types.TSESTree.Node;
  }

  const branches: TernaryBranch[] = [];
  let current: types.TSESTree.Node = node;

  while ((current as types.TSESTree.Node).type === AST_NODE_TYPES.ConditionalExpression) {
    const cond = current as types.TSESTree.ConditionalExpression;
    const discInfo = extractDiscriminant(cond.test as types.TSESTree.BinaryExpression);

    branches.push({
      test: cond.test,
      testCode: getSourceText(cond.test, sourceCode),
      testValue: discInfo?.value ?? getSourceText(cond.test, sourceCode),
      consequent: cond.consequent,
    });
    current = cond.alternate;
  }

  const fallback = current;

  if (branches.length < 2) {
    return { descriptor: null, scopeId: "", assignmentTarget: null };
  }

  const discriminants = branches.map((b) => {
    if ((b.test as types.TSESTree.Node).type === AST_NODE_TYPES.BinaryExpression) {
      const info = extractDiscriminant(b.test as types.TSESTree.BinaryExpression);
      return info?.discriminant ?? null;
    }
    return null;
  });

  if (discriminants.some((d) => d === null)) {
    return { descriptor: null, scopeId: "", assignmentTarget: null };
  }

  const firstDisc = discriminants[0]!;
  if (!discriminants.every((d) => d === firstDisc)) {
    return { descriptor: null, scopeId: "", assignmentTarget: null };
  }

  let discNode: types.TSESTree.Node = node.test;
  if ((node.test as types.TSESTree.Node).type === AST_NODE_TYPES.BinaryExpression) {
    const info = extractDiscriminant(node.test as types.TSESTree.BinaryExpression);
    if (info) {
      discNode = getNodeDiscriminant(
        (info.node as types.TSESTree.BinaryExpression).left,
        (info.node as types.TSESTree.BinaryExpression).right
      );
    }
  }

  const chainBranches: Branch[] = branches.map((b) => ({
    testCode: b.testCode,
    testValue: b.testValue,
    consequent: b.consequent,
  }));

  const descriptor: ChainDescriptor = {
    kind: "ternary",
    discriminant: firstDisc!,
    discriminantNode: discNode,
    branches: chainBranches,
    fallback,
    node,
    assignmentTarget: null,
    loc: node.loc!,
    scopeId: "",
  };

  return { descriptor, scopeId: "", assignmentTarget: null };
}

/**
 * Extract an if-else chain from an IfStatement.
 */
export function extractIfElseChain(
  node: types.TSESTree.IfStatement,
  sourceCode: { getSource: (_node: types.TSESTree.Node) => string }
): ChainExtractorResult {
  interface IfBranch {
    test: types.TSESTree.Node;
    testCode: string;
    testValue: string;
    consequent: types.TSESTree.Statement;
  }

  const branches: IfBranch[] = [];
  let current: types.TSESTree.IfStatement | null = node;

  while (current) {
    // Accept BlockStatement or ReturnStatement as consequent
    if (
      current.consequent.type !== AST_NODE_TYPES.BlockStatement &&
      current.consequent.type !== AST_NODE_TYPES.ReturnStatement
    ) {
      return { descriptor: null, scopeId: "", assignmentTarget: null };
    }

    const discInfo = extractDiscriminant(current.test as types.TSESTree.BinaryExpression);
    branches.push({
      test: current.test,
      testCode: getSourceText(current.test, sourceCode),
      testValue: discInfo?.value ?? getSourceText(current.test, sourceCode),
      consequent: current.consequent,
    });

    if (current.alternate) {
      if ((current.alternate as types.TSESTree.Node).type === AST_NODE_TYPES.IfStatement) {
        current = current.alternate as types.TSESTree.IfStatement;
      } else {
        const fallback = current.alternate;
        current = null;

        const discriminants = branches.map((b) => {
          if ((b.test as types.TSESTree.Node).type === AST_NODE_TYPES.BinaryExpression) {
            const info = extractDiscriminant(b.test as types.TSESTree.BinaryExpression);
            return info?.discriminant ?? null;
          }
          return null;
        });

        if (discriminants.some((d) => d === null)) {
          return { descriptor: null, scopeId: "", assignmentTarget: null };
        }

        const firstDisc = discriminants[0]!;
        if (!discriminants.every((d) => d === firstDisc)) {
          return { descriptor: null, scopeId: "", assignmentTarget: null };
        }

        let discNode: types.TSESTree.Node = node.test;
        if ((node.test as types.TSESTree.Node).type === AST_NODE_TYPES.BinaryExpression) {
          const info = extractDiscriminant(node.test as types.TSESTree.BinaryExpression);
          if (info) {
            discNode = getNodeDiscriminant(
              (info.node as types.TSESTree.BinaryExpression).left,
              (info.node as types.TSESTree.BinaryExpression).right
            );
          }
        }

        const chainBranches: Branch[] = branches.map((b) => ({
          testCode: b.testCode,
          testValue: b.testValue,
          consequent: b.consequent,
        }));

        const descriptor: ChainDescriptor = {
          kind: "if-else",
          discriminant: firstDisc!,
          discriminantNode: discNode,
          branches: chainBranches,
          fallback,
          node,
          assignmentTarget: null,
          loc: node.loc!,
          scopeId: "",
        };

        return { descriptor, scopeId: "", assignmentTarget: null };
      }
    } else {
      return { descriptor: null, scopeId: "", assignmentTarget: null };
    }
  }

  return { descriptor: null, scopeId: "", assignmentTarget: null };
}

/**
 * Extract an early-return chain from sequential if statements in a function body.
 */
export function extractEarlyReturnChain(
  functionBody: types.TSESTree.BlockStatement,
  sourceCode: { getSource: (_node: types.TSESTree.Node) => string }
): ChainExtractorResult {
  const statements = functionBody.body;

  for (let start = 0; start < statements.length; start++) {
    const first = statements[start];
    if (first?.type !== AST_NODE_TYPES.IfStatement) {
      continue;
    }

    const branches: Branch[] = [];
    let discriminant: string | null = null;
    let discriminantNode: types.TSESTree.Node | null = null;
    let objectKeySignature: string | null = null;
    let index = start;

    while (index < statements.length) {
      const statement = statements[index];
      if (statement?.type !== AST_NODE_TYPES.IfStatement) {
        break;
      }

      const ifStatement = statement as types.TSESTree.IfStatement;
      if (ifStatement.alternate) {
        break;
      }

      if (ifStatement.test.type !== AST_NODE_TYPES.BinaryExpression || ifStatement.test.operator !== "===") {
        break;
      }

      const discInfo = extractDiscriminant(ifStatement.test as types.TSESTree.BinaryExpression);
      if (!discInfo) {
        break;
      }

      if (discriminant === null) {
        discriminant = discInfo.discriminant;
        discriminantNode = getNodeDiscriminant(ifStatement.test.left, ifStatement.test.right);
      } else if (discInfo.discriminant !== discriminant) {
        break;
      }

      const returnInfo = getReturnStatementAndObject(ifStatement.consequent);
      if (!returnInfo) {
        break;
      }

      const currentSignature = getObjectKeySignature(returnInfo.objectExpression);
      if (!currentSignature) {
        break;
      }

      if (objectKeySignature === null) {
        objectKeySignature = currentSignature;
      } else if (currentSignature !== objectKeySignature) {
        break;
      }

      branches.push({
        testCode: getSourceText(ifStatement.test, sourceCode),
        testValue: discInfo.value,
        consequent: returnInfo.returnStatement,
        sourceNode: ifStatement,
      });

      index++;
    }

    if (branches.length >= 2 && discriminant && discriminantNode) {
      const possibleFallback = statements[index];
      const fallback = possibleFallback?.type === AST_NODE_TYPES.ReturnStatement ? possibleFallback : null;

      const descriptor: ChainDescriptor = {
        kind: "early-return",
        discriminant,
        discriminantNode,
        branches,
        fallback,
        node: functionBody,
        assignmentTarget: null,
        loc: functionBody.loc!,
        scopeId: "",
      };

      return { descriptor, scopeId: "", assignmentTarget: null };
    }
  }

  return { descriptor: null, scopeId: "", assignmentTarget: null };
}

/**
 * Extract a switch statement as a chain.
 */
export function extractSwitchChain(
  node: types.TSESTree.SwitchStatement,
  sourceCode: { getSource: (_node: types.TSESTree.Node) => string }
): ChainExtractorResult {
  const discText = getSourceText(node.discriminant, sourceCode);

  const switchBranches: Branch[] = [];
  let fallback: types.TSESTree.Node | null = null;

  for (const caseClause of node.cases) {
    if (caseClause.test === null) {
      if (fallback !== null) {
        return { descriptor: null, scopeId: "", assignmentTarget: null };
      }
      fallback = caseClause;
    } else {
      // Normalize test value to match extractDiscriminant canonical form:
      // If it's a literal, use the canonical key (type:value) to preserve type info.
      // Otherwise use the source text.
      let testValue: string;
      if (isLiteralValue(caseClause.test)) {
        const canonical = getLiteralCanonicalKey(caseClause.test);
        testValue = canonical ?? getSourceText(caseClause.test, sourceCode);
      } else {
        testValue = getSourceText(caseClause.test, sourceCode);
      }
      switchBranches.push({
        testCode: getSourceText(caseClause.test, sourceCode),
        testValue,
        consequent: caseClause,
      });
    }
  }

  if (switchBranches.length < 2) {
    return { descriptor: null, scopeId: "", assignmentTarget: null };
  }

  const descriptor: ChainDescriptor = {
    kind: "switch",
    discriminant: discText,
    discriminantNode: node.discriminant,
    branches: switchBranches,
    fallback,
    node,
    assignmentTarget: null,
    loc: node.loc!,
    scopeId: "",
  };

  return { descriptor, scopeId: "", assignmentTarget: null };
}
