import type * as types from "@typescript-eslint/types";

export interface Branch {
  testCode: string;
  testValue: string;
  consequent: types.TSESTree.Node;
}

export interface ChainDescriptor {
  kind: "ternary" | "if-else" | "switch";
  discriminant: string;
  discriminantNode: types.TSESTree.Node;
  branches: Branch[];
  fallback: types.TSESTree.Node | null;
  node: types.TSESTree.Node;
  assignmentTarget: string | null;
  loc: types.TSESTree.SourceLocation;
  scopeId: number;
}

export interface NormalizedChain {
  descriptor: ChainDescriptor;
  structureHash: string;
}

export interface AutofixResult {
  lookupName: string;
  lookupCode: string;
  replacements: Array<{
    node: types.TSESTree.Node;
    code: string;
    isFirst: boolean;
  }>;
  singleReplacement: string;
  canFix: boolean;
}

export interface DiscriminantInfo {
  discriminant: string;
  value: string;
  node: types.TSESTree.Node;
}

export interface GroupedChains {
  discriminant: string;
  structureHash: string;
  chains: ChainDescriptor[];
}
