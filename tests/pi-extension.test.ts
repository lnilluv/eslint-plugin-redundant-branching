import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import registerPiExtension from "../src/pi-extension.js";

/* eslint-disable no-unused-vars */

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface ToolResultEvent {
  toolName: string;
  input?: {
    path?: string;
    content?: string;
  };
  content: unknown[];
}

export interface PiHandlers {
  session_start: () => void | Promise<void>;
  tool_result: (event: ToolResultEvent) => void | Promise<unknown>;
}

export interface RegisteredCommandContext {
  ui: {
    notify(message: string, level: NotificationLevel): void;
  };
}

export interface RegisteredCommand {
  description: string;
  handler: (args: string, ctx: RegisteredCommandContext) => void | Promise<void>;
}

class Harness {
  handlers: Partial<PiHandlers> = {};

  command: RegisteredCommand | undefined;

  on<K extends keyof PiHandlers>(event: K, handler: PiHandlers[K]): void {
    this.handlers[event] = handler;
  }

  registerCommand(name: string, command: RegisteredCommand): void {
    if (name !== "lint-branching") {
      throw new Error(`Unexpected command registered: ${name}`);
    }

    this.command = command;
  }
}

function assertCommandRegistered(
  harness: Harness,
): asserts harness is Harness & { command: RegisteredCommand } {
  if (!harness.command) {
    throw new Error("lint-branching command was not registered");
  }
}

describe("pi extension /lint-branching command", () => {
  function createHarness() {
    const harness = new Harness();

    registerPiExtension(harness);
    assertCommandRegistered(harness);

    return harness;
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
    const harness = createHarness();
    const notifications: Array<[string, NotificationLevel]> = [];

    try {
      process.chdir(projectDir);

      const sessionStart = harness.handlers.session_start;
      if (!sessionStart) {
        throw new Error("session_start handler was not registered");
      }

      await sessionStart();

      await harness.command.handler("", {
        ui: {
          notify(message: string, level: NotificationLevel) {
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
