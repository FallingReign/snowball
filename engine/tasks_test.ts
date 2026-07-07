import { assertEquals, assertMatch } from "jsr:@std/assert";
import { validateTask, listTasks, updateTaskStatus, updateCriteriaChecks } from "./tasks.ts";
import type { RawTask, CriterionCheck } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(id: string, title: string, status: string): RawTask {
  return { id, title, status, actor: undefined, acceptance_criteria: [], exit_criteria: [], criteria_checks: [], event_log: [] };
}

function statuses(...s: string[]): Set<string> {
  return new Set(s);
}

// ---------------------------------------------------------------------------
// validateTask
// ---------------------------------------------------------------------------

Deno.test("valid task passes", () => {
  validateTask(makeTask("t1", "My Task", "backlog"), statuses("backlog", "done"), "test");
});

Deno.test("empty id is err", () => {
  let threw = false;
  try { validateTask(makeTask("", "Title", "backlog"), statuses("backlog"), "test"); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("empty title is err", () => {
  let threw = false;
  try { validateTask(makeTask("t1", "", "backlog"), statuses("backlog"), "test"); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("unknown status is err", () => {
  let errMsg = "";
  try { validateTask(makeTask("t1", "Title", "nonexistent"), statuses("backlog", "done"), "test"); }
  catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /nonexistent/);
});

// ---------------------------------------------------------------------------
// updateTaskStatus — validation path
// ---------------------------------------------------------------------------

Deno.test("updateTaskStatus rejects invalid status", async () => {
  let errMsg = "";
  try { await updateTaskStatus(Deno.cwd(), "some-task", "invalid"); }
  catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /invalid/);
});

Deno.test("updateTaskStatus rejects missing task", async () => {
  let errMsg = "";
  try { await updateTaskStatus(Deno.cwd(), "nonexistent-task-xyz", "backlog"); }
  catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /not found/);
});

// ---------------------------------------------------------------------------
// listTasks — integration
// ---------------------------------------------------------------------------

Deno.test("listTasks reads real tasks", async () => {
  const tasks = await listTasks(Deno.cwd());
  assertEquals(tasks.length > 0, true);
  for (const task of tasks) {
    assertEquals(typeof task.id, "string");
    assertEquals(typeof task.title, "string");
    assertEquals(Array.isArray(task.criteriaChecks), true);
  }
  for (let i = 1; i < tasks.length; i++) {
    assertEquals(tasks[i - 1].id <= tasks[i].id, true);
  }
});

// ---------------------------------------------------------------------------
// updateTaskStatus roundtrip
// ---------------------------------------------------------------------------

Deno.test("updateTaskStatus roundtrips status in temp dir", async () => {
  const tmpDir = await Deno.makeTempDir();
  const snowballDir = `${tmpDir}/.snowball`;
  const tasksDir = `${snowballDir}/tasks`;
  await Deno.mkdir(tasksDir, { recursive: true });
  await Deno.writeTextFile(`${snowballDir}/workflow.yaml`,
    "name: Test\ncolumns:\n  - id: backlog\n    name: Backlog\n  - id: done\n    name: Done\n"
  );
  const taskPath = `${tasksDir}/my-task.yaml`;
  await Deno.writeTextFile(taskPath, "id: my-task\ntitle: My Task\nstatus: backlog\n");
  await updateTaskStatus(tmpDir, "my-task", "done");
  const updated = await Deno.readTextFile(taskPath);
  assertMatch(updated, /done/);
  await Deno.remove(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// updateCriteriaChecks — round-trip
// ---------------------------------------------------------------------------

Deno.test("updateCriteriaChecks persists and merges checks", async () => {
  const tmpDir = await Deno.makeTempDir();
  const snowballDir = `${tmpDir}/.snowball`;
  const tasksDir = `${snowballDir}/tasks`;
  await Deno.mkdir(tasksDir, { recursive: true });
  await Deno.writeTextFile(`${snowballDir}/workflow.yaml`,
    "name: T\ncolumns:\n  - id: backlog\n    name: Backlog\n  - id: done\n    name: Done\n"
  );
  await Deno.writeTextFile(`${tasksDir}/t1.yaml`, "id: t1\ntitle: T\nstatus: backlog\n");

  const checks: CriterionCheck[] = [
    { columnId: "backlog", criterionId: "ec-1", checked: true, checkedAt: "2026-07-07T00:00:00Z" },
    { columnId: "backlog", criterionId: "ec-2", checked: false },
  ];
  await updateCriteriaChecks(tmpDir, "t1", "backlog", checks);

  const tasks = await listTasks(tmpDir);
  const t = tasks.find((t) => t.id === "t1")!;
  assertEquals(t.criteriaChecks.length, 2);
  assertEquals(t.criteriaChecks.find((c) => c.criterionId === "ec-1")?.checked, true);
  assertEquals(t.criteriaChecks.find((c) => c.criterionId === "ec-2")?.checked, false);

  // Writes for different column are preserved
  await updateCriteriaChecks(tmpDir, "t1", "done", [
    { columnId: "done", criterionId: "ec-done-1", checked: false },
  ]);
  await updateCriteriaChecks(tmpDir, "t1", "backlog", [
    { columnId: "backlog", criterionId: "ec-1", checked: true },
    { columnId: "backlog", criterionId: "ec-2", checked: true },
  ]);

  const tasks2 = await listTasks(tmpDir);
  const t2 = tasks2.find((t) => t.id === "t1")!;
  const backlog2 = t2.criteriaChecks.filter((c) => c.columnId === "backlog");
  assertEquals(backlog2.every((c) => c.checked), true);
  const done2 = t2.criteriaChecks.filter((c) => c.columnId === "done");
  assertEquals(done2.length, 1);

  await Deno.remove(tmpDir, { recursive: true });
});

Deno.test("updateCriteriaChecks throws for missing task", async () => {
  let errMsg = "";
  try { await updateCriteriaChecks(Deno.cwd(), "nonexistent-xyz", "backlog", []); }
  catch (e) { errMsg = (e as Error).message; }
  assertMatch(errMsg, /not found/);
});
