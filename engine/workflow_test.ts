import { assertEquals, assertMatch } from "jsr:@std/assert";
import {
  validateWorkflow,
  columnIds,
  loadWorkflow,
  updateColumnConfig,
} from "./workflow.ts";
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
  validateWorkflow(w);
});

Deno.test("empty columns is err", () => {
  const w = makeWorkflow([]);
  let threw = false;
  try { validateWorkflow(w); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("empty column id is err", () => {
  const w = makeWorkflow([["", "No ID"]]);
  let threw = false;
  try { validateWorkflow(w); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("duplicate column id is err", () => {
  const w = makeWorkflow([["backlog", "A"], ["backlog", "B"]]);
  let errMsg = "";
  try { validateWorkflow(w); } catch (e) { errMsg = (e as Error).message; }
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
// owner + exit_criteria validation
// ---------------------------------------------------------------------------

Deno.test("column with agent owner validates", () => {
  const w: RawWorkflow = {
    name: "Test",
    columns: [{
      id: "in-progress",
      name: "In Progress",
      wip_limit: 3,
      owner: { kind: "agent", role: "code-writer", instances: 2 },
      exit_criteria: [
        { id: "ec-1", description: "Tests pass", kind: "machine" },
        { id: "ec-2", description: "Reviewed", kind: "human" },
      ],
    }],
  };
  validateWorkflow(w);
});

Deno.test("duplicate exit criterion id is err", () => {
  const w: RawWorkflow = {
    name: "Test",
    columns: [{
      id: "col", name: "Col",
      exit_criteria: [
        { id: "dup", description: "A", kind: "machine" },
        { id: "dup", description: "B", kind: "human" },
      ],
    }],
  };
  let errMsg = "";
  try { validateWorkflow(w); } catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /duplicate/);
});

Deno.test("empty exit criterion id is err", () => {
  const w: RawWorkflow = {
    name: "Test",
    columns: [{ id: "col", name: "Col", exit_criteria: [{ id: "", description: "X", kind: "human" }] }],
  };
  let threw = false;
  try { validateWorkflow(w); } catch { threw = true; }
  assertEquals(threw, true);
});

// ---------------------------------------------------------------------------
// loadWorkflow — backward-compat defaults
// ---------------------------------------------------------------------------

Deno.test("loadWorkflow defaults owner to human when absent", async () => {
  const tmpDir = await Deno.makeTempDir();
  const dir = `${tmpDir}/.snowball`;
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(
    `${dir}/workflow.yaml`,
    "name: T\ncolumns:\n  - id: backlog\n    name: Backlog\n",
  );
  const wf = await loadWorkflow(tmpDir);
  assertEquals(wf.columns[0].owner.kind, "human");
  assertEquals(wf.columns[0].owner.instances, 1);
  assertEquals(wf.columns[0].exitCriteria.length, 0);
  assertEquals(wf.columns[0].linksTo, null);
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("loadWorkflow reads agent owner with instances", async () => {
  const tmpDir = await Deno.makeTempDir();
  const dir = `${tmpDir}/.snowball`;
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(`${dir}/workflow.yaml`,
    "name: T\ncolumns:\n  - id: ip\n    name: In Progress\n    owner:\n      kind: agent\n      role: coder\n      instances: 2\n    exit_criteria:\n      - id: ec1\n        description: Tests pass\n        kind: machine\n"
  );
  const wf = await loadWorkflow(tmpDir);
  const col = wf.columns[0];
  assertEquals(col.owner.kind, "agent");
  assertEquals(col.owner.role, "coder");
  assertEquals(col.owner.instances, 2);
  assertEquals(col.exitCriteria.length, 1);
  assertEquals(col.exitCriteria[0].kind, "machine");
  await Deno.remove(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// updateColumnConfig — round-trip
// ---------------------------------------------------------------------------

Deno.test("updateColumnConfig persists owner and exit_criteria", async () => {
  const tmpDir = await Deno.makeTempDir();
  const dir = `${tmpDir}/.snowball`;
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(
    `${dir}/workflow.yaml`,
    "name: T\ncolumns:\n  - id: backlog\n    name: Backlog\n  - id: done\n    name: Done\n",
  );
  await updateColumnConfig(tmpDir, "backlog", {
    wip_limit: 5,
    owner: { kind: "agent", role: "planner", instances: 1 },
    exit_criteria: [{ id: "e1", description: "Ready", kind: "human" }],
  });
  const wf = await loadWorkflow(tmpDir);
  const col = wf.columns.find((c) => c.id === "backlog")!;
  assertEquals(col.wipLimit, 5);
  assertEquals(col.owner.kind, "agent");
  assertEquals(col.owner.role, "planner");
  assertEquals(col.exitCriteria.length, 1);
  assertEquals(col.exitCriteria[0].id, "e1");
  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("updateColumnConfig throws for unknown column", async () => {
  const tmpDir = await Deno.makeTempDir();
  const dir = `${tmpDir}/.snowball`;
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(`${dir}/workflow.yaml`,
    "name: T\ncolumns:\n  - id: backlog\n    name: Backlog\n"
  );
  let errMsg = "";
  try { await updateColumnConfig(tmpDir, "nonexistent", { wip_limit: 3 }); }
  catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /not found/);
  await Deno.remove(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// loadWorkflow (integration — reads from real .snowball/ directory)
// ---------------------------------------------------------------------------

Deno.test("loadWorkflow reads real workflow.yaml", async () => {
  const wf = await loadWorkflow(Deno.cwd());
  assertEquals(wf.columns.length > 0, true);
  assertEquals(typeof wf.name, "string");
  const ids = wf.columns.map((c) => c.id);
  assertEquals(ids.includes("backlog"), true);
  for (const col of wf.columns) {
    assertEquals(["human", "agent"].includes(col.owner.kind), true);
    assertEquals(Array.isArray(col.exitCriteria), true);
  }
});
