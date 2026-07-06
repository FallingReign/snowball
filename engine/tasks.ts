import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import type { Task, EventEntry, RawTask, RawWorkflow } from "./types.ts";
import { loadRawWorkflow, columnIds } from "./workflow.ts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single raw task against the set of valid workflow column ids.
 * Throws a descriptive Error on the first violation found.
 *
 * @param task           Raw task deserialized from YAML.
 * @param validStatuses  Set of valid column ids from the workflow.
 * @param source         A label used in error messages (e.g. the file path).
 */
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
    eventLog: (raw.event_log ?? []).map((e): EventEntry => ({
      timestamp: e.timestamp,
      message: e.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/**
 * Read all .snowball/tasks/*.yaml files under baseDir, validate them, and
 * return the sorted list of Tasks (sorted by id; files by filename first for
 * deterministic reads).
 */
export async function listTasks(baseDir: string): Promise<Task[]> {
  // Load workflow to get valid statuses.
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
      if (
        entry.isFile &&
        (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))
      ) {
        entries.push(entry);
      }
    }
  } catch (e) {
    throw new Error(`Cannot read tasks directory ${tasksDir}: ${e}`);
  }

  // Sort by filename for deterministic reading order.
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

  // Secondary sort by id for stable ordering regardless of filename.
  tasks.sort((a, b) => a.id.localeCompare(b.id));

  return tasks;
}

/**
 * Update the status field of the task identified by taskId in
 * .snowball/tasks/<taskId>.yaml. All other fields are preserved via YAML
 * round-trip. Throws if the new status is not a valid workflow column or the
 * task file does not exist.
 */
export async function updateTaskStatus(
  baseDir: string,
  taskId: string,
  newStatus: string,
): Promise<void> {
  // Validate new status against the workflow.
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

  // Check that the task file exists.
  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`task '${taskId}' not found (expected ${path})`);
  }

  // Read, update, write — preserving all other fields via the YAML round-trip.
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
