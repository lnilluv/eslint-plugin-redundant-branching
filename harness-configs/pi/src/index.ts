/**
 * pi-lookup-lint — pi extension for eslint-plugin-lookup-table
 *
 * Automatically runs the no-redundant-branching ESLint rule after every
 * file write or edit on TypeScript files. Diagnostics are fed back to
 * the LLM so it can fix the violations in the same turn.
 *
 * Install: pi install npm:pi-lookup-lint
 * Requires: eslint-plugin-lookup-table configured in eslint.config.js
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("pi-lookup-lint active — redundant branching patterns will be caught", "info");
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath: string | undefined = event.input?.path;
    if (!filePath || (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx"))) return;

    try {
      const result = await pi.exec("npx", [
        "eslint",
        "--no-error-on-unmatched-pattern",
        "--format",
        "stylish",
        filePath,
      ], { timeout: 15_000 });

      if (result.code !== 0 && result.stdout.trim()) {
        return {
          content: [
            ...event.content,
            {
              type: "text" as const,
              text: `\n\n⚠️ eslint-plugin-lookup-table found redundant branching:\n\n${result.stdout}\n\nFix these by consolidating the repeated conditional chains into a single lookup table.`,
            },
          ],
        };
      }
    } catch {
      // Never block on lint failure
    }
  });

  pi.registerCommand("lint-branching", {
    description: "Scan all TypeScript files for redundant branching patterns",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Scanning for redundant branching patterns…", "info");
      try {
        const result = await pi.exec("npx", [
          "eslint",
          "--no-error-on-unmatched-pattern",
          "--format",
          "stylish",
          "--ext",
          ".ts,.tsx",
          ".",
        ], { timeout: 60_000 });

        if (result.code === 0) {
          ctx.ui.notify("No redundant branching patterns found.", "success");
        } else {
          ctx.ui.notify(
            `Found redundant branching patterns:\n${result.stdout}`,
            "warning",
          );
        }
      } catch (err) {
        ctx.ui.notify(`Lint scan failed: ${err}`, "error");
      }
    },
  });
}
