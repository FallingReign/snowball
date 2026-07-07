import { spawn } from "node:child_process";
import type { RuntimeAdapter, CriterionToCheck } from "./runtime-adapter.ts";

// ---------------------------------------------------------------------------
// Public config types
// ---------------------------------------------------------------------------

export interface CopilotCliConfig {
  /** Path to the gh binary. Default: "gh" */
  cliPath?: string;
  /** Additional instructions injected into every validation prompt. */
  instructions?: string;
  /** Timeout for each external call (ms). Default: 30 000. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Internal spawn abstraction (enables test injection)
// ---------------------------------------------------------------------------

export interface SpawnResult {
  stdout: string;
  stderr: string;
  /** Process exit code, or -1 on timeout */
  exitCode: number;
}

export type SpawnFn = (
  executable: string,
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs: number; stdinNull: boolean },
) => Promise<SpawnResult>;

/**
 * Default spawn implementation using node:child_process.
 * Works in both Deno 2 (Node.js compat) and plain Node.js.
 */
export function nodeSpawn(
  executable: string,
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs: number; stdinNull: boolean },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, {
      stdio: [opts.stdinNull ? "ignore" : "inherit", "pipe", "pipe"],
      env: opts.env, // undefined → inherit parent env
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, exitCode: -1 });
    }, opts.timeoutMs);

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * CopilotCliAdapter — drives GitHub Copilot CLI in headless/non-interactive
 * mode to validate machine exit criteria.
 *
 * For each machine criterion it:
 *   1. Calls `gh copilot suggest --target shell "<validation-prompt>"` with
 *      stdin closed (non-interactive).  The suggestion appears in stdout
 *      before any interactive menu; we parse it immediately.
 *   2. Executes the suggested shell command with a timeout.
 *   3. Treats exit-code 0 as "criterion satisfied".
 *
 * Requires `gh` CLI (https://cli.github.com) authenticated via `gh auth login`.
 * Fails fast with a descriptive error when unauthenticated or `gh` is missing.
 *
 * Auth requirement: run `gh auth login` (or set GITHUB_TOKEN) before use.
 */
export class CopilotCliAdapter implements RuntimeAdapter {
  readonly name = "copilot-cli";

  private readonly cliPath: string;
  private readonly instructions: string;
  private readonly timeoutMs: number;
  private readonly _spawn: SpawnFn;

  constructor(
    config: CopilotCliConfig = {},
    spawnFn: SpawnFn = nodeSpawn,
  ) {
    this.cliPath = config.cliPath?.trim() || "gh";
    this.instructions = config.instructions?.trim() ?? "";
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this._spawn = spawnFn;
  }

  async validateMachineCriteria(
    taskId: string,
    columnId: string,
    criteria: CriterionToCheck[],
  ): Promise<CriterionToCheck[]> {
    // Fail fast if not authenticated — clear error, no thrashing.
    await this._checkAuth();

    const now = new Date().toISOString();

    const results: CriterionToCheck[] = [];
    for (const criterion of criteria) {
      if (criterion.kind !== "machine") {
        results.push(criterion); // human criteria pass through unchanged
        continue;
      }
      try {
        const satisfied = await this._validateCriterion(taskId, columnId, criterion);
        results.push({
          ...criterion,
          checked: satisfied,
          checkedAt: satisfied ? now : criterion.checkedAt,
        });
      } catch (err) {
        console.error(
          `[copilot-cli] criterion '${criterion.id}' for task '${taskId}' failed:`,
          err,
        );
        results.push({ ...criterion, checked: false });
      }
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _checkAuth(): Promise<void> {
    const result = await this._spawn(
      this.cliPath,
      ["auth", "status"],
      { timeoutMs: 10_000, stdinNull: true },
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `GitHub CLI is not authenticated. Run 'gh auth login' to authenticate.\n` +
        `Output: ${(result.stderr || result.stdout).trim()}`,
      );
    }
  }

  private async _validateCriterion(
    taskId: string,
    columnId: string,
    criterion: CriterionToCheck,
  ): Promise<boolean> {
    const prompt = this._buildPrompt(taskId, columnId, criterion.description);

    const suggestion = await this._getSuggestion(prompt);
    if (!suggestion) {
      console.warn(
        `[copilot-cli] No parseable suggestion for criterion '${criterion.id}' — marking unchecked`,
      );
      return false;
    }

    return this._runValidationCommand(suggestion);
  }

  private _buildPrompt(
    taskId: string,
    columnId: string,
    criterionDescription: string,
  ): string {
    const parts: string[] = [
      `Task '${taskId}' in kanban stage '${columnId}'.`,
    ];
    if (this.instructions) {
      parts.push(`Context: ${this.instructions}.`);
    }
    parts.push(
      `Write a single shell command that exits with code 0 if the following criterion is satisfied,`,
      `or exits with a non-zero code if it is not.`,
      `The command must run non-interactively and MUST NOT modify any source files.`,
      `Criterion: "${criterionDescription}"`,
    );
    return parts.join(" ");
  }

  private async _getSuggestion(prompt: string): Promise<string | null> {
    // Merge NO_COLOR / notifier flags into the parent environment.
    // We do NOT use process.env directly at the module level (keep it lazy).
    const baseEnv = _getProcessEnv();
    const env: Record<string, string> = {
      ...baseEnv,
      NO_COLOR: "1",
      GH_NO_UPDATE_NOTIFIER: "1",
    };

    const result = await this._spawn(
      this.cliPath,
      ["copilot", "suggest", "--target", "shell", prompt],
      { timeoutMs: this.timeoutMs, stdinNull: true, env },
    );

    return parseCopilotSuggestion(result.stdout);
  }

  private async _runValidationCommand(command: string): Promise<boolean> {
    const isWindows = _isWindows();
    const shellCmd = isWindows ? "cmd" : "sh";
    const shellFlag = isWindows ? "/c" : "-c";

    const result = await this._spawn(
      shellCmd,
      [shellFlag, command],
      { timeoutMs: this.timeoutMs, stdinNull: true },
    );
    return result.exitCode === 0;
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Parse the suggested command from `gh copilot suggest` stdout.
 *
 * The CLI emits output like:
 *   …
 *   Suggestion:
 *
 *     npm test
 *
 *   ? Select an option …
 *
 * We look for the "Suggestion:" marker, then collect non-empty lines until
 * the interactive prompt ("?") or a blank line after content.
 * Returns null if no suggestion is found.
 */
export function parseCopilotSuggestion(output: string): string | null {
  const lines = output.split("\n");
  let foundMarker = false;
  const commandLines: string[] = [];

  for (const line of lines) {
    if (foundMarker) {
      const trimmed = line.trim();
      // Stop at interactive prompt lines
      if (trimmed.startsWith("?") || trimmed.toLowerCase().startsWith("select an option")) {
        break;
      }
      if (trimmed) {
        commandLines.push(trimmed);
      } else if (commandLines.length > 0) {
        // Blank line after we've already collected content — command is done
        break;
      }
    } else if (/suggestion:/i.test(line)) {
      foundMarker = true;
    }
  }

  if (commandLines.length === 0) return null;
  // Join multi-line commands (e.g. line-continuation) with &&
  return commandLines.join(" && ");
}

// ---------------------------------------------------------------------------
// Platform helpers (lazy to avoid import-time side-effects in tests)
// ---------------------------------------------------------------------------

function _getProcessEnv(): Record<string, string> {
  // `process` is available as a global in Node.js and in Deno 2 (Node.js compat).
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string>;
  }
  return {};
}

function _isWindows(): boolean {
  if (typeof process !== "undefined" && process.platform) {
    return process.platform === "win32";
  }
  return false;
}
