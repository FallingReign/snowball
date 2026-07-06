import { assertEquals, assertMatch } from "jsr:@std/assert";
import { validateTask, listTasks, updateTaskStatus } from "./tasks.ts";
import type { RawTask } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(id: string, title: string, status: string): RawTask {
  return {
    id,
    title,
    status,
    actor: undefined,
    acceptance_criteria: [],
    exit_criteria: [],
    event_log: [],
  };
}

function statuses(...s: string[]): Set<string> {
  return new Set(s);
}

// ---------------------------------------------------------------------------
// validateTask
// ---------------------------------------------------------------------------

Deno.test("valid task passes", () => {
  const cols = statuses("backlog", "done");
  const t = makeTask("t1", "My Task", "backlog");
  // Should not throw
  validateTask(t, cols, "test");
});

Deno.test("empty id is err", () => {
  const cols = statuses("backlog");
  const t = makeTask("", "Title", "backlog");
  let threw = false;
  try {
    validateTask(t, cols, "test");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("empty title is err", () => {
  const cols = statuses("backlog");
  const t = makeTask("t1", "", "backlog");
  let threw = false;
  try {
    validateTask(t, cols, "test");
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("unknown status is err", () => {
  const cols = statuses("backlog", "done");
  const t = makeTask("t1", "Title", "nonexistent");
  let errMsg = "";
  try {
    validateTask(t, cols, "test");
  } catch (e) {
    errMsg = (e as Error).message;
  }
  assertMatch(errMsg, /nonexistent/);
});

// ---------------------------------------------------------------------------
// updateTaskStatus — validation path (invalid status / missing task)
// ---------------------------------------------------------------------------

Deno.test("updateTaskStatus rejects invalid status", async () => {
  let errMsg = "";
  try {
    await updateTaskStatus(Deno.cwd(), "some-task", "invalid");
  } catch (e) {
    errMsg = (e as Error).message;
  }
  // Error should mention the invalid status name
  assertMatch(errMsg, /invalid/);
});

Deno.test("updateTaskStatus rejects missing task", async () => {
  let errMsg = "";
  try {
    await updateTaskStatus(Deno.cwd(), "nonexistent-task-xyz", "backlog");
  } catch (e) {
    errMsg = (e as Error).message;
  }
  assertMatch(errMsg, /not found/);
});

// ---------------------------------------------------------------------------
// listTasks — integration (reads real .snowball/tasks/)
// ---------------------------------------------------------------------------

Deno.test("listTasks reads real tasks", async () => {
  const tasks = await listTasks(Deno.cwd());
  assertEquals(tasks.length > 0, true);
  for (const task of tasks) {
    assertEquals(typeof task.id, "string");
    assertEquals(typeof task.title, "string");
    assertEquals(typeof task.status, "string");
  }
  // Tasks must be sorted by id
  for (let i = 1; i < tasks.length; i++) {
    assertEquals(tasks[i - 1].id <= tasks[i].id, true);
  }
});

// ---------------------------------------------------------------------------
// updateTaskStatus roundtrip — uses a temp dir so real data is untouched
// ---------------------------------------------------------------------------

Deno.test("updateTaskStatus roundtrips status in temp dir", async () => {
  const tmpDir = await Deno.makeTempDir();
  const snowballDir = `${tmpDir}/.snowball`;
  const tasksDir = `${snowballDir}/tasks`;
  await Deno.mkdir(tasksDir, { recursive: true });

  await Deno.writeTextFile(
    `${snowballDir}/workflow.yaml`,
    "name: Test\ncolumns:\n  - id: backlog\n    name: Backlog\n  - id: done\n    name: Done\n",
  );

  const taskPath = `${tasksDir}/my-task.yaml`;
  await Deno.writeTextFile(
    taskPath,
    "id: my-task\ntitle: My Task\nstatus: backlog\n",
  );

  await updateTaskStatus(tmpDir, "my-task", "done");

  const updated = await Deno.readTextFile(taskPath);
  assertMatch(updated, /done/);

  await Deno.remove(tmpDir, { recursive: true });
});
