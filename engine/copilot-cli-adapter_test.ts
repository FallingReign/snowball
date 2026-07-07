import { assertEquals, assertMatch, assertRejects } from "jsr:@std/assert";
import { CopilotCliAdapter, parseCopilotSuggestion } from "./copilot-cli-adapter.ts";
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

// ---------------------------------------------------------------------------
// parseCopilotSuggestion
// ---------------------------------------------------------------------------

Deno.test("parseCopilotSuggestion: returns null for empty output", () => {
  assertEquals(parseCopilotSuggestion(""), null);
});

Deno.test("parseCopilotSuggestion: extracts command after 'Suggestion:'", () => {
  const out = `
Welcome to GitHub Copilot in the CLI!

Suggestion:

  npm test

? Select an option
`;
  assertEquals(parseCopilotSuggestion(out), "npm test");
});

Deno.test("parseCopilotSuggestion: handles missing suggestion marker", () => {
  const out = "Welcome to GitHub Copilot\nSomething went wrong\n";
  assertEquals(parseCopilotSuggestion(out), null);
});

Deno.test("parseCopilotSuggestion: joins multi-line command with &&", () => {
  const out = `
Suggestion:

  cd /tmp
  npm test

? Select an option
`;
  assertEquals(parseCopilotSuggestion(out), "cd /tmp && npm test");
});

Deno.test("parseCopilotSuggestion: case-insensitive marker", () => {
  const out = `SUGGESTION:\n\n  echo hello\n`;
  assertEquals(parseCopilotSuggestion(out), "echo hello");
});

// ---------------------------------------------------------------------------
// CopilotCliAdapter — auth check
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: throws descriptive error when not authenticated", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([fail("You are not logged into any GitHub hosts.", 1)]),
  );

  await assertRejects(
    () =>
      adapter.validateMachineCriteria("task1", "col1", [
        { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
      ]),
    Error,
    "not authenticated",
  );
});

// ---------------------------------------------------------------------------
// CopilotCliAdapter — human criteria pass-through
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: human criteria pass through unchanged", async () => {
  // Auth succeeds; no further calls expected
  const adapter = new CopilotCliAdapter({}, mockSpawn([ok()]));

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
// CopilotCliAdapter — machine criteria validation
// ---------------------------------------------------------------------------

Deno.test("CopilotCliAdapter: marks machine criterion checked when command exits 0", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok(), // auth check
      ok("Welcome\n\nSuggestion:\n\n  npm test\n\n? Select an option"), // copilot suggest
      ok(), // validation command
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All unit tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, true);
  assertEquals(typeof result[0].checkedAt, "string");
});

Deno.test("CopilotCliAdapter: leaves machine criterion unchecked when command exits non-zero", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok(), // auth check
      ok("Suggestion:\n\n  npm test\n"), // copilot suggest
      fail("Tests failed", 1), // validation command fails
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: leaves machine criterion unchecked when no suggestion parseable", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok(), // auth check
      ok("Welcome to GitHub Copilot\nError processing request\n"), // no suggestion
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: handles timeout (exitCode -1) as failure", async () => {
  const adapter = new CopilotCliAdapter(
    { timeoutMs: 100 },
    mockSpawn([
      ok(), // auth check
      ok("Suggestion:\n\n  npm test\n"), // copilot suggest
      { stdout: "", stderr: "", exitCode: -1 }, // timeout
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);
  assertEquals(result[0].checked, false);
});

Deno.test("CopilotCliAdapter: mixed criteria — machine validated, human unchanged", async () => {
  const adapter = new CopilotCliAdapter(
    {},
    mockSpawn([
      ok(), // auth check
      ok("Suggestion:\n\n  echo ok\n"), // copilot suggest for ec-1
      ok(), // validation command exits 0
    ]),
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "All tests pass", kind: "machine", checked: false },
    { id: "ec-2", description: "Human sign-off", kind: "human", checked: false },
  ];
  const result = await adapter.validateMachineCriteria("task1", "col1", criteria);

  assertEquals(result[0].id, "ec-1");
  assertEquals(result[0].checked, true);  // machine — validated
  assertEquals(result[1].id, "ec-2");
  assertEquals(result[1].checked, false); // human — unchanged
});

Deno.test("CopilotCliAdapter: instruction injected into prompt (spawn receives it)", async () => {
  const calls: string[][] = [];
  const trackingSpawn: SpawnFn = async (exe, args, _opts) => {
    calls.push([exe, ...args]);
    if (calls.length === 1) return ok(); // auth check
    if (calls.length === 2) return ok("Suggestion:\n\n  echo ok\n"); // suggest
    return ok(); // command
  };

  const adapter = new CopilotCliAdapter(
    { instructions: "context: javascript project" },
    trackingSpawn,
  );

  const criteria: CriterionToCheck[] = [
    { id: "ec-1", description: "Tests pass", kind: "machine", checked: false },
  ];
  await adapter.validateMachineCriteria("task1", "col1", criteria);

  // The second call should be to gh copilot suggest with our instructions in the prompt
  assertEquals(calls[1][0], "gh");
  assertEquals(calls[1][1], "copilot");
  assertEquals(calls[1][2], "suggest");
  assertEquals(calls[1][3], "--target");
  assertEquals(calls[1][4], "shell");
  // The prompt (last arg) should contain the instructions
  assertEquals(calls[1][5].includes("context: javascript project"), true);
});

Deno.test("CopilotCliAdapter: adapter name is 'copilot-cli'", () => {
  const adapter = new CopilotCliAdapter();
  assertEquals(adapter.name, "copilot-cli");
});

Deno.test("CopilotCliAdapter: custom cliPath forwarded to spawn", async () => {
  const calls: string[][] = [];
  const trackingSpawn: SpawnFn = async (exe, args, _opts) => {
    calls.push([exe, ...args]);
    return ok();
  };

  const adapter = new CopilotCliAdapter({ cliPath: "/usr/local/bin/gh" }, trackingSpawn);
  // Only auth check; no machine criteria to process
  await adapter.validateMachineCriteria("t1", "c1", [
    { id: "h1", description: "Human review", kind: "human", checked: false },
  ]);

  assertEquals(calls[0][0], "/usr/local/bin/gh");
});
