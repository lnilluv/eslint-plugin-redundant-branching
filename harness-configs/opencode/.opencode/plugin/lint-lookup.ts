/**
 * lint-lookup — opencode plugin for eslint-plugin-lookup-table
 *
 * Runs ESLint with the no-redundant-branching rule after every file
 * write or edit on TypeScript files. Diagnostics are logged to the
 * console so opencode can surface them to the model.
 */
import type { Plugin } from "@opencode-ai/plugin";

export const LintLookup: Plugin = async ({ $ }) => {
  return {
    tool: {
      execute: {
        after: async (input, output) => {
          if (input.tool !== "edit" && input.tool !== "write") return;

          const file: string | undefined = output.args?.filePath;
          if (!file || (!file.endsWith(".ts") && !file.endsWith(".tsx"))) return;

          try {
            const result =
              await $`npx eslint --no-error-on-unmatched-pattern --fix ${file} 2>&1`.quiet();
            if (result.exitCode !== 0) {
              console.log(
                `[lint-lookup] eslint-plugin-lookup-table found issues in ${file}:\n${result.stdout}`,
              );
            }
          } catch {
            // Never crash the plugin on lint failure
          }
        },
      },
    },
  };
};
