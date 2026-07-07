import type { RuntimeAdapter } from "./runtime-adapter.ts";
import { loadRawWorkflow } from "./workflow.ts";
import { listTasks, updateTaskStatus, updateCriteriaChecks } from "./tasks.ts";
import type { CriterionCheck } from "./types.ts";

// ---------------------------------------------------------------------------
// Result type (matches the shape returned by the legacy fake-agent-advance route)
// ---------------------------------------------------------------------------

export interface AgentAdvanceResult {
  taskId: string;
  advanced: boolean;
  nextColumnId: string | null;
  satisfiedCriteria: string[];
  unsatisfiedCriteria: string[];
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * runAgentOnColumn — adapter-agnostic implementation of the agent-advance loop.
 *
 * For every task currently in `columnId`:
 *  1. Builds the current per-column criterion check state.
 *  2. Delegates machine-criterion validation to `adapter`.
 *  3. Persists updated checks to the task YAML.
 *  4. Hard-gates advancement: the card moves to the next column ONLY when
 *     ALL exit criteria (machine + human) are satisfied.
 *
 * Reuses the same gating logic introduced in Slice A.
 */
export async function runAgentOnColumn(
  baseDir: string,
  columnId: string,
  adapter: RuntimeAdapter,
): Promise<AgentAdvanceResult[]> {
  const raw = await loadRawWorkflow(baseDir);

  const colIndex = raw.columns.findIndex((c) => c.id === columnId);
  if (colIndex === -1) {
    throw new Error(`column '${columnId}' not found`);
  }
  const col = raw.columns[colIndex];
  if (!col.owner || col.owner.kind !== "agent") {
    throw new Error(`column '${columnId}' is not agent-owned`);
  }

  const nextCol = raw.columns[colIndex + 1] ?? null;
  const exitCriteria = col.exit_criteria ?? [];

  const allTasks = await listTasks(baseDir);
  const colTasks = allTasks.filter((t) => t.status === columnId);

  const results: AgentAdvanceResult[] = [];

  for (const task of colTasks) {
    // Build the current criterion check state for this task in this column.
    const currentChecks = task.criteriaChecks.filter((c) => c.columnId === columnId);

    const criteriaToCheck = exitCriteria.map((ec) => {
      const existing = currentChecks.find((c) => c.criterionId === ec.id);
      return {
        id: ec.id,
        description: ec.description,
        kind: ec.kind,
        checked: existing?.checked ?? false,
        checkedAt: existing?.checkedAt,
      };
    });

    // Delegate machine-criterion validation to the adapter.
    const validated = await adapter.validateMachineCriteria(
      task.id,
      columnId,
      criteriaToCheck,
    );

    // Persist updated checks back to task YAML.
    const updatedChecks: CriterionCheck[] = validated.map((v) => ({
      columnId,
      criterionId: v.id,
      checked: v.checked,
      checkedAt: v.checkedAt,
    }));
    await updateCriteriaChecks(baseDir, task.id, columnId, updatedChecks);

    // Hard gate: ALL criteria must be satisfied for the card to advance.
    const unsatisfied = validated.filter((v) => !v.checked).map((v) => v.id);
    const satisfied = validated.filter((v) => v.checked).map((v) => v.id);

    if (unsatisfied.length === 0 && nextCol) {
      await updateTaskStatus(baseDir, task.id, nextCol.id);
      results.push({
        taskId: task.id,
        advanced: true,
        nextColumnId: nextCol.id,
        satisfiedCriteria: satisfied,
        unsatisfiedCriteria: [],
      });
    } else {
      results.push({
        taskId: task.id,
        advanced: false,
        nextColumnId: nextCol?.id ?? null,
        satisfiedCriteria: satisfied,
        unsatisfiedCriteria: unsatisfied,
      });
    }
  }

  return results;
}
