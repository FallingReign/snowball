import { assertEquals, assertMatch } from "jsr:@std/assert";
import { validateWorkflow, columnIds, loadWorkflow } from "./workflow.ts";
import type { RawWorkflow } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkflow(cols: [string, string][]): RawWorkflow {
  return {
    name: "Test",
    columns: cols.map(([id, name]) => ({ id, name, wip_limit: null })),
    actors: [],
    wip_limits: {},
  };
}

// ---------------------------------------------------------------------------
// validateWorkflow
// ---------------------------------------------------------------------------

Deno.test("valid workflow passes", () => {
  const w = makeWorkflow([["backlog", "Backlog"], ["done", "Done"]]);
  // Should not throw
  validateWorkflow(w);
});

Deno.test("empty columns is err", () => {
  const w = makeWorkflow([]);
  let threw = false;
  try {
    validateWorkflow(w);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("empty column id is err", () => {
  const w = makeWorkflow([["", "No ID"]]);
  let threw = false;
  try {
    validateWorkflow(w);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("duplicate column id is err", () => {
  const w = makeWorkflow([["backlog", "A"], ["backlog", "B"]]);
  let errMsg = "";
  try {
    validateWorkflow(w);
  } catch (e) {
    errMsg = (e as Error).message;
  }
  assertMatch(errMsg, /duplicate/);
});

Deno.test("columnIds returns all ids", () => {
  const w = makeWorkflow([["backlog", "Backlog"], ["done", "Done"]]);
  const ids = columnIds(w);
  assertEquals(ids.has("backlog"), true);
  assertEquals(ids.has("done"), true);
  assertEquals(ids.size, 2);
});

// ---------------------------------------------------------------------------
// loadWorkflow (integration — reads from real .snowball/ directory)
// ---------------------------------------------------------------------------

Deno.test("loadWorkflow reads real workflow.yaml", async () => {
  const wf = await loadWorkflow(Deno.cwd());
  assertEquals(wf.columns.length > 0, true);
  assertEquals(typeof wf.name, "string");
  // The real workflow has "backlog" column
  const ids = wf.columns.map((c) => c.id);
  assertEquals(ids.includes("backlog"), true);
});
