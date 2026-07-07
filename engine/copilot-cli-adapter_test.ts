import { assertEquals, assertMatch, assertRejects } from "jsr:@std/assert";
import { CopilotCliAdapter, parseCopilotVerdict } from "./copilot-cli-adapter.ts";
import type { SpawnFn, SpawnResult } from "./copilot-cli-adapter.ts";
import type { CriterionToCheck } from "./runtime-adapter.ts";

// ---------------------------------------------------------------------------
// Mock spawn helpers
// ---------------------------------------------------------------------------

/** Build a SpawnFn that returns the given results in order. */
function mockSpawn(responses: SpawnResult[]): SpawnFn {
  let i = 0;
  return async (_exe, _args, _opts) => {
    const r = responses[i++];
    if (!r) return { stdout: "", stderr: "", exitCode: 0 };
    return r;
  };
}

function ok(stdout = ""): SpawnResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr = "", exitCode = 1): SpawnResult {
  return { stdout: "", stderr, exitCode };
}

function copilotReply(body: string): SpawnResult {
  // Simulate a full copilot -p response with footer.
  const footer = [
    "",
    "",
    "Changes    +0 -0",
    "AI Credits 5.0 (5s)",
    "Tokens     ↑ 1000 (500 cached) • ↓ 50",
    "Resume     copilot --resume=abc123",
  ].join("\n");
  return ok(`● skill(ponytail)\n\n${body}${footer}`);
}

// ---------------------------------------------------------------------------
// parseCopilotVerdict
// ---------------------------------------------------------------------------

Deno.test("parseCopilotVerdict: returns null for empty output", () => {
  assertEquals(parseCopilotVerdict(""), null);
});

Deno.test("parseCopilotVerdict: returns true for VERDICT: PASS", () => {
  const out = copilotReply("All tests pass.\n\nVERDICT: PASS\n").stdout;
  assertEquals(parseCopilotVerdict(out), true);
});

Deno.test("parseCopilotVerdict: returns false for VERDICT: FAIL", () => {
  const out = copilotReply("Tests are failing.\n\nVERDICT: FAIL\n").stdout;
  assertEquals(parseCopilotVerdict(out), false);
});

Deno.test("parseCopilotVerdict: returns null when verdict is missing", () => {
  const out = copilotReply("I cannot determine this.\n").stdout;
  assertEquals(parseCopilotVerdict(out), null);
});

Deno.test("parseCopilotVerdict: stops at footer — verdict after footer is ignored", () => {
  const out = [
    "● skill(ponytail)",
    "",
    "Some reasoning here.",
    "",
    "Changes    +0 -0",
    "AI Credits 5.0 (5s)",
    "VERDICT: PASS",  // after footer — should be ignored
  ].join("\n");
  assertEquals(parseCopilotVerdict(out), null);
});

Deno.test("parseCopilotVerdict: case-insensitive", () => {
  const out = copilotReply("verdict: pass\n").stdout;
  assertEquals(parseCopilotVerdict(out), true);
});

Deno.test("parseCopilotVerdict: last VERDICT wins if multiple stand-alone lines", () => {
  // Parser overwrites on each VERDICT line; last one wins.
  const out = copilotReply("VERDICT: PASS\nOn reflection:\nVERDICT: FAIL\n").stdout;
  assertEquals(parseCopilotVerdict(out), false);
});

// ---------------------------------------------------------------------------
// CopilotCliAdapter — binary check
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: throws clear error when binary missing (ENOENT)", async () => {
  const spawn: SpawnFn = async (_exe, _args, _opts) => {
    const err = new Error("spawn copilot ENOENT") as Error & { code: string };
    err.code = "ENOENT";
    throw err;
  };
  const adapter = new CopilotCliAdapter({}, spawn);

  await assertRejects(
    () =>
      adapter.validateMachineCriteria("task1", "col1", [
        { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
      ]),
    Error,
    "not found",
  );
});

Deno.test("CopilotCliAdapter: throws clear error when --version exits non-zero", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([fail("something went wrong", 1)]),
  );

  let threw = false;
  try {
    await adapter.validateMachineCriteria("task1", "col1", [
      { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
    ]);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

// ---------------------------------------------------------------------------
// CopilotCliAdapter — human criteria pass-through
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: human criteria pass through unchanged", async () => {
  // Only binary check; no further calls
  const adapter = new CopilotCliAdapter({}, mockSpawn([ok("GitHub Copilot CLI 1.0.68")]));

  const criteria: CriterionToCheck[] = [
    { id: "h-1", description: "Human review done", kind: "human", checked: false },
    { id: "h-2", description: "Signed off", kind: "human", checked: true, checkedAt: "2026-07-01T00:00:00Z" },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result.length, 2);
  assertEquals(result[0].checked, false);
  assertEquals(result[1].checked, true);
  assertEquals(result[1].checkedAt, "2026-07-01T00:00:00Z");
});

// ---------------------------------------------------------------------------
// CopilotCliAdapter — machine criteria validation via VERDICT
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: marks criterion checked on VERDICT: PASS", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"), // --version check
      copilotReply("All tests pass.\n\nVERDICT: PASS"),   // copilot -p
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All unit tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, true);
  assertEquals(typeof result[0].checkedAt, "string");
});

Deno.test("CopilotCliAdapter: leaves criterion unchecked on VERDICT: FAIL", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"), // --version check
      copilotReply("Tests are failing.\n\nVERDICT: FAIL"), // copilot -p
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All unit tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: leaves criterion unchecked when no VERDICT in output", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"),
      copilotReply("I cannot determine this."), // no VERDICT
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: leaves criterion unchecked on timeout (exitCode -1)", async () => {
  const adapter = new CopilotCliAdapter(
    { timeoutMs: 100 },
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"),
      { stdout: "", stderr: "", exitCode: -1 }, // timeout
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);
  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: leaves criterion unchecked on non-zero exit", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"),
      fail("copilot API error", 1),
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);
  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: mixed — machine validated, human unchanged", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok("GitHub Copilot CLI 1.0.68"),
      copilotReply("Tests pass.\n\nVERDICT: PASS"),
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All tests pass", kind: "machine", checked: false },
    { id: "ec-2", description: "Human sign-off", kind: "human", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, true);   // machine — PASS
  assertEquals(result[1].checked, false);  // human — unchanged
});

Deno.test("CopilotCliAdapter: instructions injected into prompt", async () => {
  const calls: Array<[string, string[]]> = [];
  const trackingSpawn: SpawnFn = async (exe, args, _opts) => {
    calls.push([exe, [...args]]);
    if (calls.length === 1) return ok("GitHub Copilot CLI 1.0.68");
    return copilotReply("VERDICT: PASS");
  };

  const adapter = new CopilotCliAdapter(
    { instructions: "TypeScript project; tests via deno task test" },
    trackingSpawn,
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  await adapter.validateMachineCriteria("task1", "col1", criteria);

  // Second call is copilot -p <prompt>
  assertEquals(calls[1][0], "copilot");
  assertEquals(calls[1][1][0], "-p");
  assertMatch(calls[1][1][1], /TypeScript project/);
  assertMatch(calls[1][1][1], /Tests pass/);
  assertMatch(calls[1][1][1], /VERDICT: PASS/);
  assertMatch(calls[1][1][1], /VERDICT: FAIL/);
});

Deno.test("CopilotCliAdapter: custom cliPath forwarded to binary check", async () => {
  const calls: string[] = [];
  const trackingSpawn: SpawnFn = async (exe, _args, _opts) => {
    calls.push(exe);
    return ok("GitHub Copilot CLI 1.0.68");
  };

  const adapter = new CopilotCliAdapter(
    { cliPath: "/opt/copilot/bin/copilot" },
    trackingSpawn,
  );
  // human only — only binary check fires
  await adapter.validateMachineCriteria("t1", "c1", [
    { id: "h1", description: "Human review", kind: "human", checked: false },
  ]);

  assertEquals(calls[0], "/opt/copilot/bin/copilot");
});

Deno.test("CopilotCliAdapter: adapter name is 'copilot-cli'", () => {
  assertEquals(new CopilotCliAdapter().name, "copilot-cli");
});
