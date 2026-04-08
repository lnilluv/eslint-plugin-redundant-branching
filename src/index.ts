import noRedundantBranching, { name as ruleName } from "./rules/no-redundant-branching.js";

const plugin = {
  name: "lookup-table",
  rules: {
    [ruleName]: noRedundantBranching,
  },
  configs: {
    recommended: {
      rules: {
        "lookup-table/no-redundant-branching": "error",
      },
    },
  },
};

export default plugin;
export { ruleName, noRedundantBranching };
