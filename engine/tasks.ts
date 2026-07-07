import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import type {
  Task,
  EventEntry,
  CriterionCheck,
  RawTask,
  RawCriterionCheck,
  RawWorkflow,
} from "./types.ts";
import { loadRawWorkflow, columnIds } from "./workflow.ts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTask(
  task: RawTask,
  validStatuses: Set<string>,
  source: string,
): void {
  if (!task.id) {
    throw new Error(`${source}: task id must not be empty`);
  }
  if (!task.title) {
    throw new Error(`${source}: task '${task.id}' title must not be empty`);
  }
  if (!validStatuses.has(task.status)) {
    const sorted = [...validStatuses].sort();
    throw new Error(
      `${source}: task '${task.id}' has unknown status '${task.status}'; valid statuses: ${JSON.stringify(sorted)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

function toTask(raw: RawTask): Task {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    actor: raw.actor ?? null,
    acceptanceCriteria: raw.acceptance_criteria ?? [],
    exitCriteria: raw.exit_criteria ?? [],
    criteriaChecks: (raw.criteria_checks ?? []).map((c): CriterionCheck => ({
      columnId: c.column_id,
      criterionId: c.criterion_id,
      checked: c.checked,
      checkedAt: c.checked_at,
    })),
    eventLog: (raw.event_log ?? []).map((e): EventEntry => ({
      timestamp: e.timestamp,
      message: e.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

export async function listTasks(baseDir: string): Promise<Task[]> {
  let raw: RawWorkflow;
  try {
    raw = await loadRawWorkflow(baseDir);
  } catch (e) {
    throw new Error(`Failed to load workflow: ${e}`);
  }
  const validStatuses = columnIds(raw);

  const tasksDir = `${baseDir}/.snowball/tasks`;
  const entries: Deno.DirEntry[] = [];
  try {
    for await (const entry of Deno.readDir(tasksDir)) {
      if (entry.isFile && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
        entries.push(entry);
      }
    }
  } catch (e) {
    throw new Error(`Cannot read tasks directory ${tasksDir}: ${e}`);
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const tasks: Task[] = [];
  for (const entry of entries) {
    const path = `${tasksDir}/${entry.name}`;
    let content: string;
    try {
      content = await Deno.readTextFile(path);
    } catch (e) {
      throw new Error(`Cannot read ${path}: ${e}`);
    }
    let rawTask: RawTask;
    try {
      rawTask = parseYaml(content) as RawTask;
    } catch (e) {
      throw new Error(`Cannot parse ${path}: ${e}`);
    }
    validateTask(rawTask, validStatuses, path);
    tasks.push(toTask(rawTask));
  }

  tasks.sort((a, b) => a.id.localeCompare(b.id));
  return tasks;
}

export async function updateTaskStatus(
  baseDir: string,
  taskId: string,
  newStatus: string,
): Promise<void> {
  let raw: RawWorkflow;
  try {
    raw = await loadRawWorkflow(baseDir);
  } catch (e) {
    throw new Error(`Failed to load workflow: ${e}`);
  }
  const validStatuses = columnIds(raw);
  if (!validStatuses.has(newStatus)) {
    const sorted = [...validStatuses].sort();
    throw new Error(
      `status '${newStatus}' is not a valid workflow column; valid statuses: ${JSON.stringify(sorted)}`,
    );
  }

  const path = `${baseDir}/.snowball/tasks/${taskId}.yaml`;
  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`task '${taskId}' not found (expected ${path})`);
  }

  let content: string;
  try {
    content = await Deno.readTextFile(path);
  } catch (e) {
    throw new Error(`Cannot read ${path}: ${e}`);
  }
  let doc: Record<string, unknown>;
  try {
    doc = parseYaml(content) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e}`);
  }

  doc["status"] = newStatus;

  let newContent: string;
  try {
    newContent = stringifyYaml(doc);
  } catch (e) {
    throw new Error(`Cannot serialize task '${taskId}': ${e}`);
  }

  try {
    await Deno.writeTextFile(path, newContent);
  } catch (e) {
    throw new Error(`Cannot write ${path}: ${e}`);
  }
}

/**
 * Update the exit-criteria check state for a specific (task, column) pair.
 * Replaces existing checks for that column; preserves checks for other columns.
 */
export async function updateCriteriaChecks(
  baseDir: string,
  taskId: string,
  columnId: string,
  checks: CriterionCheck[],
): Promise<void> {
  const path = `${baseDir}/.snowball/tasks/${taskId}.yaml`;

  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`task '${taskId}' not found (expected ${path})`);
  }

  const content = await Deno.readTextFile(path);
  const doc = parseYaml(content) as Record<string, unknown>;

  // Keep checks for other columns; replace for this column.
  const existing = ((doc["criteria_checks"] as RawCriterionCheck[] | undefined) ?? [])
    .filter((c) => c.column_id !== columnId);

  const newChecks: RawCriterionCheck[] = checks.map((c) => {
    const entry: RawCriterionCheck = {
      column_id: columnId,
      criterion_id: c.criterionId,
      checked: c.checked,
    };
    if (c.checkedAt) entry.checked_at = c.checkedAt;
    return entry;
  });

  doc["criteria_checks"] = [...existing, ...newChecks];

  await Deno.writeTextFile(path, stringifyYaml(doc));
}
