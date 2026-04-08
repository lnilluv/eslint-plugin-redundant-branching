import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { RuleListener, RuleModule } from "@typescript-eslint/utils/ts-eslint";
import type * as types from "@typescript-eslint/types";
import { extractTernaryChain, extractIfElseChain, extractSwitchChain } from "../utils/chain-extractor.js";
import { groupChains } from "../utils/normalizer.js";
import { generateLookupFix } from "../utils/autofix.js";
import type { ChainDescriptor } from "../utils/types.js";

type Options = [
  {
    threshold?: number;
    includeSwitchStatements?: boolean;
    includeIfElseChains?: boolean;
    ignoreDiscriminants?: string[];
  }
];

export const name = "no-redundant-branching" as const;

const rule: RuleModule<"redundantBranching", Options> = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Detect redundant conditional chains branching on the same discriminant",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            default: 2,
            minimum: 2,
          },
          includeSwitchStatements: {
            type: "boolean",
            default: true,
          },
          includeIfElseChains: {
            type: "boolean",
            default: true,
          },
          ignoreDiscriminants: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      redundantBranching:
        "{{count}} conditional chains branch on '{{discriminant}}' with the same structure. Consider a lookup table. See lines {{lines}}.",
    },
  },
  defaultOptions: [
    {
      threshold: 2,
      includeSwitchStatements: true,
      includeIfElseChains: true,
      ignoreDiscriminants: [],
    },
  ],
  create(context) {
    const options = context.options[0] ?? {};
    const threshold = options.threshold ?? 2;
    const includeSwitchStatements = options.includeSwitchStatements ?? true;
    const includeIfElseChains = options.includeIfElseChains ?? true;
    const ignoreDiscriminants = new Set(options.ignoreDiscriminants ?? []);

    const sourceCode = context.sourceCode;
    const chains: ChainDescriptor[] = [];

    const getSource = (node: types.TSESTree.Node): string => {
      return sourceCode.getText(node);
    };

    /**
     * Get a scope key for a node based on its enclosing function scope.
     * Returns the range of the enclosing function or 'global' for top-level.
     */
    function getScopeKey(node: types.TSESTree.Node): string {
      let current: types.TSESTree.Node | undefined = node;
      while (current) {
        if (
          current.type === AST_NODE_TYPES.FunctionDeclaration ||
          current.type === AST_NODE_TYPES.FunctionExpression ||
          current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          current.type === AST_NODE_TYPES.MethodDefinition
        ) {
          const range = current.range;
          if (range) {
            return `fn:${range[0]}-${range[1]}`;
          }
        }
        current = (current as types.TSESTree.Node & { parent?: types.TSESTree.Node }).parent;
      }
      return "global";
    }

    /**
     * Find the replacement target for a chain node.
     */
    function findReplacementTarget(
      chainNode: types.TSESTree.Node
    ): { target: types.TSESTree.Node; canFix: boolean } {
      const parent = chainNode.parent;
      if (parent?.type === AST_NODE_TYPES.VariableDeclarator) {
        const varDecl = parent as types.TSESTree.VariableDeclarator;
        const varDeclParent = varDecl.parent;
        if (
          varDeclParent?.type === AST_NODE_TYPES.VariableDeclaration &&
          (varDeclParent as types.TSESTree.VariableDeclaration).kind === "const"
        ) {
          if (
            (varDeclParent as types.TSESTree.VariableDeclaration)
              .declarations.length === 1
          ) {
            return {
              target: varDeclParent as types.TSESTree.VariableDeclaration,
              canFix: true,
            };
          }
        }
        return { target: chainNode, canFix: false };
      }
      if (parent?.type === AST_NODE_TYPES.ExpressionStatement) {
        return { target: parent, canFix: true };
      }
      return { target: chainNode, canFix: false };
    }

    /**
     * Filter a group of chains to only include top-level chains.
     * A chain is top-level if its node is not contained within another chain's node.
     */
    function filterTopLevelChains(
      chainsInScope: ChainDescriptor[]
    ): ChainDescriptor[] {
      const sorted = [...chainsInScope].sort((a, b) => {
        const aStart = a.node.range?.[0] ?? 0;
        const bStart = b.node.range?.[0] ?? 0;
        return aStart - bStart;
      });

      const topLevel: ChainDescriptor[] = [];
      const chainRanges: Array<{ start: number; end: number; chain: ChainDescriptor }> = [];

      for (const chain of sorted) {
        const start = chain.node.range?.[0] ?? 0;
        const end = chain.node.range?.[1] ?? 0;

        let isContained = false;
        for (const existing of chainRanges) {
          if (start >= existing.start && end <= existing.end && start !== existing.start) {
            isContained = true;
            break;
          }
        }

        if (!isContained) {
          topLevel.push(chain);
          chainRanges.push({ start, end, chain });
        }
      }

      return topLevel;
    }

    const rule: RuleListener = {
      ConditionalExpression(node) {
        if (!includeIfElseChains) return;
        // Skip nested ternaries - only process the outermost ConditionalExpression
        if (node.parent?.type === AST_NODE_TYPES.ConditionalExpression) {
          return;
        }
        const result = extractTernaryChain(node, { getSource });
        if (result.descriptor) {
          const parent = node.parent;
          let assignmentTarget: string | null = null;
          if (
            parent?.type === AST_NODE_TYPES.VariableDeclarator &&
            (parent as types.TSESTree.VariableDeclarator).id.type === "Identifier"
          ) {
            assignmentTarget = (
              (parent as types.TSESTree.VariableDeclarator)
                .id as types.TSESTree.Identifier
            ).name;
          }
          result.descriptor.assignmentTarget = assignmentTarget;
          result.descriptor.scopeId = hashString(getScopeKey(node));
          chains.push(result.descriptor);
        }
      },

      IfStatement(node) {
        if (!includeIfElseChains) return;
        // Skip else-if chains - only process the outermost IfStatement
        // An IfStatement nested as the alternate of another IfStatement is an else-if
        if (
          node.parent?.type === AST_NODE_TYPES.IfStatement &&
          (node.parent as types.TSESTree.IfStatement).alternate === node
        ) {
          return;
        }
        const result = extractIfElseChain(node, { getSource });
        if (result.descriptor) {
          result.descriptor.scopeId = hashString(getScopeKey(node));
          chains.push(result.descriptor);
        }
      },

      SwitchStatement(node) {
        if (!includeSwitchStatements) return;
        const result = extractSwitchChain(node, { getSource });
        if (result.descriptor) {
          result.descriptor.scopeId = hashString(getScopeKey(node));
          chains.push(result.descriptor);
        }
      },

      "Program:exit"() {
        const groups = groupChains(chains, threshold);

        for (const [, group] of groups) {
          if (group.length < threshold) continue;

          // Check if discriminant is in ignore list
          const firstDisc = group[0]!.discriminant;
          if (ignoreDiscriminants.has(firstDisc)) continue;

          // Group by scope within this discriminant+structure group
          const scopeGroups = new Map<number, ChainDescriptor[]>();
          for (const chain of group) {
            const existing = scopeGroups.get(chain.scopeId) ?? [];
            existing.push(chain);
            scopeGroups.set(chain.scopeId, existing);
          }

          for (const [, scopeGroup] of scopeGroups) {
            if (scopeGroup.length < threshold) continue;

            // Filter to only top-level chains (chains whose node is not
            // contained within another chain's node in this group)
            const topLevelChains = filterTopLevelChains(scopeGroup);
            if (topLevelChains.length < threshold) continue;

            const discriminant = topLevelChains[0]!.discriminant;
            const lines = topLevelChains
              .map((c) => c.loc?.start?.line ?? 0)
              .filter((l) => l > 0)
              .join(", ");

            // Determine if we can autofix: all chains must be safe const declarations
            const allCanFix = topLevelChains.every((chain) => {
              const { canFix } = findReplacementTarget(chain.node);
              return canFix;
            });

            // Find the full contiguous range to replace
            let firstStart = Infinity;
            let lastEnd = -Infinity;

            for (const chain of topLevelChains) {
              const { target } = findReplacementTarget(chain.node);
              const start = target.range?.[0] ?? 0;
              const end = target.range?.[1] ?? 0;
              if (start < firstStart) {
                firstStart = start;
              }
              if (end > lastEnd) {
                lastEnd = end;
              }
            }

            // Generate a single fix for the entire group (only if all can fix)
            const fixResult = allCanFix
              ? generateLookupFix(topLevelChains, { getSource })
              : null;

            // Report each chain in the group
            for (const chain of topLevelChains) {
              context.report({
                node: chain.node,
                messageId: "redundantBranching",
                data: {
                  count: topLevelChains.length,
                  discriminant,
                  lines,
                },
                fix:
                  fixResult?.singleReplacement && fixResult.canFix
                    ? ( fixer) => {
                        return fixer.replaceTextRange(
                          [firstStart, lastEnd],
                          fixResult.singleReplacement
                        );
                      }
                    : undefined,
              });
            }
          }
        }
      },
    };

    return rule;
  },
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default rule;
