/**
 * pi extension for eslint-plugin-lookup-table
 *
 * Automatically runs the no-redundant-branching ESLint rule after every
 * file write or edit on TypeScript/JavaScript files. Diagnostics are fed
 * back to the LLM so it can fix the violations in the same turn.
 *
 * Install: pi install npm:eslint-plugin-lookup-table
 *
 * Everything is bundled — no separate peer dependencies needed.
 */
import { ESLint } from "eslint";
import plugin from "./index.js";

const LINTABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const LINT_TIMEOUT_MS = 10_000;

let eslintInstance: ESLint | null = null;

function getEslint(): ESLint {
  if (!eslintInstance) {
    eslintInstance = new ESLint({
      overrideConfigFile: true,
      allowInlineConfig: false,
      overrideConfig: {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        plugins: { "lookup-table": plugin as any },
        rules: { "lookup-table/no-redundant-branching": "error" },
      },
    });
  }
  return eslintInstance;
}

function extname(p: string): string {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i) : "";
}

export default function (pi: any) {
  pi.on("session_start", async () => {
    eslintInstance = null; // reset on new session
  });

  pi.on("tool_result", async (event: any) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath: string | undefined = event.input?.path;
    if (!filePath || !LINTABLE.has(extname(filePath))) return;

    try {
      const content =
        event.toolName === "write"
          ? (event.input?.content as string) ?? ""
          : undefined;

      const lint = getEslint();

      const resultsPromise = content != null
        ? lint.lintText(content, { filePath })
        : lint.lintFiles([filePath]);

      const timer = setTimeout(() => {}, LINT_TIMEOUT_MS);
      const results = await Promise.race([
        resultsPromise,
        new Promise<null>((r) => setTimeout(() => r(null), LINT_TIMEOUT_MS)),
      ]);
      clearTimeout(timer);

      if (!results) return;

      const messages = (results as ESLint.LintResult[])
        .flatMap((r) => r.messages)
        .filter((m) => m.ruleId === "lookup-table/no-redundant-branching");

      if (messages.length === 0) return;

      const lines = messages.map(
        (m) => `  line ${m.line}: ${m.message}`
      );

      return {
        content: [
          ...event.content,
          {
            type: "text" as const,
            text: [
              "",
              "⚠️ Redundant branching detected:",
              ...lines,
              "",
              "Consolidate the repeated conditional chains into a single lookup table.",
            ].join("\n"),
          },
        ],
      };
    } catch {
      // Never block on lint failure
    }
  });

  pi.registerCommand("lint-branching", {
    description: "Scan all TypeScript files for redundant branching patterns",
    handler: async (_args: string, ctx: any) => {
      ctx.ui.notify("Scanning for redundant branching patterns…", "info");
      try {
        const lint = getEslint();
        const results = await lint.lintFiles(["**/*.{ts,tsx}"]);
        const issues = results.flatMap((r) =>
          r.messages
            .filter((m) => m.ruleId === "lookup-table/no-redundant-branching")
            .map((m) => `${r.filePath}:${m.line} — ${m.message}`)
        );

        if (issues.length === 0) {
          ctx.ui.notify("No redundant branching patterns found.", "success");
        } else {
          ctx.ui.notify(
            `Found ${issues.length} redundant branching pattern(s):\n${issues.join("\n")}`,
            "warning",
          );
        }
      } catch (err) {
        ctx.ui.notify(`Lint scan failed: ${err}`, "error");
      }
    },
  });
}
