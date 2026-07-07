import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import type {
  Column,
  ColumnOwner,
  ExitCriterion,
  Actor,
  Workflow,
  RawWorkflow,
  RawColumn,
  RawColumnOwner,
  RawExitCriterion,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a raw workflow object (deserialized from YAML).
 * Throws a descriptive Error on the first violation found.
 */
export function validateWorkflow(workflow: RawWorkflow): void {
  if (workflow.columns.length === 0) {
    throw new Error("workflow.yaml must define at least one column");
  }
  const seen = new Set<string>();
  for (const col of workflow.columns) {
    if (!col.id) {
      throw new Error("every column must have a non-empty id");
    }
    if (seen.has(col.id)) {
      throw new Error(`duplicate column id: '${col.id}'`);
    }
    seen.add(col.id);
    // Validate exit criteria ids are unique within a column
    if (col.exit_criteria) {
      const critSeen = new Set<string>();
      for (const ec of col.exit_criteria) {
        if (!ec.id) {
          throw new Error(`column '${col.id}': every exit criterion must have a non-empty id`);
        }
        if (critSeen.has(ec.id)) {
          throw new Error(`column '${col.id}': duplicate exit criterion id: '${ec.id}'`);
        }
        critSeen.add(ec.id);
      }
    }
  }
}

/**
 * Return the set of valid column ids from a raw workflow.
 */
export function columnIds(workflow: RawWorkflow): Set<string> {
  return new Set(workflow.columns.map((c) => c.id));
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function toColumnOwner(raw?: RawColumnOwner): ColumnOwner {
  if (!raw || raw.kind === "human") {
    return { kind: "human", instances: 1, runtime: "fake", runtimeConfig: {} };
  }
  return {
    kind: "agent",
    role: raw.role ?? "",
    instances: raw.instances ?? 1,
    runtime: raw.runtime ?? "fake",
    runtimeConfig: raw.runtime_config
      ? {
          cliPath: raw.runtime_config.cli_path,
          model: raw.runtime_config.model,
          timeoutMs: raw.runtime_config.timeout_ms,
          instructions: raw.runtime_config.instructions,
        }
      : {},
  };
}

function toExitCriteria(raw?: RawExitCriterion[]): ExitCriterion[] {
  return (raw ?? []).map((c): ExitCriterion => ({
    id: c.id,
    description: c.description,
    kind: c.kind,
  }));
}

function toWorkflow(raw: RawWorkflow): Workflow {
  return {
    name: raw.name,
    columns: raw.columns.map((c): Column => ({
      id: c.id,
      name: c.name,
      wipLimit: c.wip_limit ?? null,
      owner: toColumnOwner(c.owner),
      exitCriteria: toExitCriteria(c.exit_criteria),
      linksTo: c.links_to ?? null,
    })),
    actors: (raw.actors ?? []).map((a): Actor => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
    })),
    wipLimits: raw.wip_limits ?? {},
  };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/**
 * Parse and validate .snowball/workflow.yaml under baseDir.
 * Returns the raw validated workflow (snake_case).
 */
export async function loadRawWorkflow(baseDir: string): Promise<RawWorkflow> {
  const path = `${baseDir}/.snowball/workflow.yaml`;
  let content: string;
  try {
    content = await Deno.readTextFile(path);
  } catch (e) {
    throw new Error(`Cannot read ${path}: ${e}`);
  }
  let raw: RawWorkflow;
  try {
    raw = parseYaml(content) as RawWorkflow;
  } catch (e) {
    throw new Error(`Cannot parse workflow.yaml: ${e}`);
  }
  validateWorkflow(raw);
  return raw;
}

/**
 * Load, validate and convert .snowball/workflow.yaml under baseDir.
 * Returns the camelCase Workflow ready for the frontend.
 */
export async function loadWorkflow(baseDir: string): Promise<Workflow> {
  return toWorkflow(await loadRawWorkflow(baseDir));
}

/**
 * Serialize and write a raw workflow back to .snowball/workflow.yaml.
 */
export async function saveWorkflow(baseDir: string, raw: RawWorkflow): Promise<void> {
  const path = `${baseDir}/.snowball/workflow.yaml`;
  let content: string;
  try {
    content = stringifyYaml(raw as unknown as Record<string, unknown>);
  } catch (e) {
    throw new Error(`Cannot serialize workflow: ${e}`);
  }
  try {
    await Deno.writeTextFile(path, content);
  } catch (e) {
    throw new Error(`Cannot write ${path}: ${e}`);
  }
}

/**
 * Describes which fields of a column may be updated via updateColumnConfig.
 */
export interface ColumnConfigUpdate {
  wip_limit?: number | null;
  owner?: RawColumnOwner;
  exit_criteria?: RawExitCriterion[];
}

/**
 * Update a single column's configuration (owner, wip_limit, exit_criteria).
 * All other columns and workflow-level fields are preserved.
 */
export async function updateColumnConfig(
  baseDir: string,
  columnId: string,
  update: ColumnConfigUpdate,
): Promise<void> {
  const raw = await loadRawWorkflow(baseDir);
  const col = raw.columns.find((c: RawColumn) => c.id === columnId);
  if (!col) {
    throw new Error(`Column '${columnId}' not found in workflow`);
  }

  if ("wip_limit" in update) {
    col.wip_limit = update.wip_limit ?? null;
  }
  if (update.owner !== undefined) {
    col.owner = update.owner;
  }
  if (update.exit_criteria !== undefined) {
    col.exit_criteria = update.exit_criteria;
  }

  validateWorkflow(raw);
  await saveWorkflow(baseDir, raw);
}
