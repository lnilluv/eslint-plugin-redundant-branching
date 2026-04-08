import noRedundantBranching, { name as ruleName } from "./rules/no-redundant-branching.js";

const plugin = {
  name: "redundant-branching",
  rules: {
    [ruleName]: noRedundantBranching,
  },
  configs: {
    recommended: {
      rules: {
        "redundant-branching/no-redundant-branching": "error",
      },
    },
  },
};

export default plugin;
export { ruleName, noRedundantBranching };
