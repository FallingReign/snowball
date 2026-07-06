import { parse as parseYaml } from "jsr:@std/yaml";
import type { Column, Actor, Workflow, RawWorkflow } from "./types.ts";

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
  }
}

/**
 * Return the set of valid column ids from a raw workflow.
 */
export function columnIds(workflow: RawWorkflow): Set<string> {
  return new Set(workflow.columns.map((c) => c.id));
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

function toWorkflow(raw: RawWorkflow): Workflow {
  return {
    name: raw.name,
    columns: raw.columns.map((c): Column => ({
      id: c.id,
      name: c.name,
      wipLimit: c.wip_limit ?? null,
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
 * Used internally by the tasks module.
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
