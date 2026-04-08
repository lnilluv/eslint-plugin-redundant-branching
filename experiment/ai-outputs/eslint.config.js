import js from "@eslint/js";
import tsparser from "@typescript-eslint/parser";
import plugin from "../../dist/index.js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: null, // No type checking needed for evaluation
      },
    },
    plugins: {
      "redundant-branching": plugin,
    },
    rules: {
      "redundant-branching/no-redundant-branching": "error",
    },
  },
];
