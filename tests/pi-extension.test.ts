import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import registerPiExtension from "../src/pi-extension.js";

describe("pi extension /lint-branching command", () => {
  function createHarness() {
    const handlers = new Map<string, (...args: any[]) => any>();
    const commands = new Map<string, any>();

    registerPiExtension({
      on(event: string, handler: (...args: any[]) => any) {
        handlers.set(event, handler);
      },
      registerCommand(name: string, command: any) {
        commands.set(name, command);
      },
    } as any);

    const command = commands.get("lint-branching");
    if (!command) {
      throw new Error("lint-branching command was not registered");
    }

    return {
      handlers,
      command,
    };
  }

  async function writeProject(files: Record<string, string>) {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), "lint-branching-"));

    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = path.join(projectDir, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }

    return projectDir;
  }

  async function runLintBranching(files: Record<string, string>) {
    const cwd = process.cwd();
    const projectDir = await writeProject(files);
    const { handlers, command } = createHarness();
    const notifications: Array<[string, string]> = [];

    try {
      process.chdir(projectDir);
      await handlers.get("session_start")?.();

      await command.handler("", {
        ui: {
          notify(message: string, level: string) {
            notifications.push([message, level]);
          },
        },
      });

      return notifications;
    } finally {
      process.chdir(cwd);
      await rm(projectDir, { recursive: true, force: true });
    }
  }

  test("reports success for TS-only projects", async () => {
    const notifications = await runLintBranching({
      "src/app.ts": "const answer = 42;\n",
    });

    expect(notifications).toContainEqual([
      "No redundant branching patterns found.",
      "success",
    ]);
    expect(notifications.some(([, level]) => level === "error")).toBe(false);
  });

  test("reports success for TSX-only projects", async () => {
    const notifications = await runLintBranching({
      "src/app.tsx": "const answer = 42;\n",
    });

    expect(notifications).toContainEqual([
      "No redundant branching patterns found.",
      "success",
    ]);
    expect(notifications.some(([, level]) => level === "error")).toBe(false);
  });
});
