import { spawn } from "node:child_process";
import type { RuntimeAdapter, CriterionToCheck } from "./runtime-adapter.ts";

// ---------------------------------------------------------------------------
// Public config types
// ---------------------------------------------------------------------------

export interface CopilotCliConfig {
  /** Path to the standalone copilot binary. Default: "copilot" */
  cliPath?: string;
  /** Additional instructions injected into every validation prompt. */
  instructions?: string;
  /** Timeout for each external call (ms). Default: 60 000 — model calls take ~15 s. */
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
 * CopilotCliAdapter — drives the standalone GitHub Copilot CLI (`copilot`)
 * in non-interactive mode to validate machine exit criteria.
 *
 * **Invocation:** `copilot -p "<prompt>"` with stdin closed.
 * The model replies with reasoning and ends with exactly:
 *   VERDICT: PASS  (criterion satisfied)
 *   VERDICT: FAIL  (criterion not satisfied)
 *
 * Unparseable / timed-out / errored calls are treated as FAIL.
 *
 * **No arbitrary shell execution.** The adapter reads Copilot's verdict from
 * its reply — it does NOT run any shell command the model suggests.
 *
 * **Auth:** The binary must already be authenticated (`copilot` is logged in).
 * If the binary is missing, a clear error is thrown.
 *
 * **Spawn injection:** Pass a mock `SpawnFn` as the second constructor argument
 * to test without live Copilot.
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
    this.cliPath = config.cliPath?.trim() || "copilot";
    this.instructions = config.instructions?.trim() ?? "";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this._spawn = spawnFn;
  }

  async validateMachineCriteria(
    taskId: string,
    columnId: string,
    criteria: CriterionToCheck[],
  ): Promise<CriterionToCheck[]> {
    // Verify the binary is present — fail fast with a clear message.
    await this._checkBinary();

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

  /** Run `copilot --version` to confirm the binary is accessible. */
  private async _checkBinary(): Promise<void> {
    try {
      const result = await this._spawn(
        this.cliPath,
        ["--version"],
        { timeoutMs: 5_000, stdinNull: true },
      );
      if (result.exitCode !== 0 && result.exitCode !== -1) {
        throw new Error(
          `'${this.cliPath} --version' exited ${result.exitCode}: ${result.stderr.trim()}`,
        );
      }
    } catch (err: unknown) {
      const msg = (err as { code?: string; message?: string }).code === "ENOENT"
        ? `Copilot CLI binary not found: '${this.cliPath}'. Install from https://docs.github.com/copilot/how-tos/copilot-cli`
        : `Copilot CLI is not accessible: ${err}`;
      throw new Error(msg);
    }
  }

  private async _validateCriterion(
    taskId: string,
    columnId: string,
    criterion: CriterionToCheck,
  ): Promise<boolean> {
    const prompt = this._buildPrompt(taskId, columnId, criterion.description);
    const result = await this._spawn(
      this.cliPath,
      ["-p", prompt],
      { timeoutMs: this.timeoutMs, stdinNull: true },
    );

    if (result.exitCode === -1) {
      console.warn(
        `[copilot-cli] criterion '${criterion.id}' timed out after ${this.timeoutMs}ms — FAIL`,
      );
      return false;
    }
    if (result.exitCode !== 0) {
      console.warn(
        `[copilot-cli] criterion '${criterion.id}' exited ${result.exitCode} — FAIL\n${result.stderr.trim()}`,
      );
      return false;
    }

    const verdict = parseCopilotVerdict(result.stdout);
    if (verdict === null) {
      console.warn(
        `[copilot-cli] criterion '${criterion.id}': no VERDICT found in output — FAIL`,
      );
      return false;
    }
    return verdict;
  }

  private _buildPrompt(
    taskId: string,
    columnId: string,
    criterionDescription: string,
  ): string {
    const lines: string[] = [
      `You are a software agent validating a kanban task.`,
      `Task ID: '${taskId}' in stage '${columnId}'.`,
    ];
    if (this.instructions) {
      lines.push(`Project context: ${this.instructions}`);
    }
    lines.push(
      ``,
      `Determine whether the following exit criterion is currently satisfied by examining`,
      `the project state. DO NOT modify any files.`,
      `Reply with your reasoning, then end your reply with EXACTLY one of:`,
      `VERDICT: PASS`,
      `VERDICT: FAIL`,
      ``,
      `Criterion: "${criterionDescription}"`,
    );
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Parse the VERDICT from `copilot -p` output.
 *
 * The standalone Copilot CLI emits output in this shape:
 *   ● skill(ponytail)
 *
 *   <model reply>
 *   VERDICT: PASS   ← or VERDICT: FAIL
 *
 *   Changes    +0 -0
 *   AI Credits …
 *   Tokens     …
 *   Resume     copilot --resume=…
 *
 * We scan lines up to the footer (which starts with "Changes", "AI Credits",
 * "Tokens", or "Resume") and return true for PASS, false for FAIL, null if
 * the verdict is absent or unparseable.
 */
export function parseCopilotVerdict(output: string): boolean | null {
  const footerPattern = /^(Changes|AI Credits|Tokens|Resume)\s/i;
  const lines = output.split("\n");

  let verdict: boolean | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (footerPattern.test(trimmed)) break; // stop at footer

    if (/^VERDICT:\s*PASS$/i.test(trimmed)) {
      verdict = true;
    } else if (/^VERDICT:\s*FAIL$/i.test(trimmed)) {
      verdict = false;
    }
  }

  return verdict;
}
