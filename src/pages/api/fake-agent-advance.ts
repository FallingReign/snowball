import type { APIRoute } from "astro";
import { loadRawWorkflow } from "../../../engine/workflow.ts";
import { listTasks, updateTaskStatus, updateCriteriaChecks } from "../../../engine/tasks.ts";
import { FakeRuntimeAdapter } from "../../../engine/fake-runtime-adapter.ts";
import type { CriterionCheck } from "../../../engine/types.ts";

interface AgentAdvanceResult {
  taskId: string;
  advanced: boolean;
  nextColumnId: string | null;
  satisfiedCriteria: string[];
  unsatisfiedCriteria: string[];
}

/**
 * POST /api/fake-agent-advance
 * Body: { columnId }
 *
 * Runs the FakeRuntimeAdapter against every task currently in the given
 * agent-owned column:
 *  1. Validates machine exit criteria (marks them checked).
 *  2. Checks if ALL criteria (machine + human) are satisfied.
 *  3. If yes: advances the card to the next column (hard gate, no override).
 *  4. If no: blocks — reports which criteria remain unsatisfied.
 *
 * Returns an array of AgentAdvanceResult per task.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { columnId?: string };
    const { columnId } = body;
    if (!columnId) {
      return Response.json({ error: "columnId is required" }, { status: 400 });
    }

    const baseDir = process.cwd();
    const raw = await loadRawWorkflow(baseDir);

    // Find the column and verify it is agent-owned.
    const colIndex = raw.columns.findIndex((c) => c.id === columnId);
    if (colIndex === -1) {
      return Response.json({ error: `column '${columnId}' not found` }, { status: 404 });
    }
    const col = raw.columns[colIndex];
    if (!col.owner || col.owner.kind !== "agent") {
      return Response.json(
        { error: `column '${columnId}' is not agent-owned` },
        { status: 400 },
      );
    }

    // Determine the next column (natural flow order).
    const nextCol = raw.columns[colIndex + 1] ?? null;

    // Load all tasks in this column.
    const allTasks = await listTasks(baseDir);
    const colTasks = allTasks.filter((t) => t.status === columnId);

    const adapter = new FakeRuntimeAdapter();
    const results: AgentAdvanceResult[] = [];
    const exitCriteria = col.exit_criteria ?? [];

    for (const task of colTasks) {
      // Build current check state for this column.
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

      // Fake adapter validates machine criteria.
      const validated = await adapter.validateMachineCriteria(
        task.id,
        columnId,
        criteriaToCheck,
      );

      // Persist updated checks.
      const updatedChecks: CriterionCheck[] = validated.map((v) => ({
        columnId,
        criterionId: v.id,
        checked: v.checked,
        checkedAt: v.checkedAt,
      }));
      await updateCriteriaChecks(baseDir, task.id, columnId, updatedChecks);

      // Hard gate: ALL criteria must be satisfied.
      const unsatisfied = validated.filter((v) => !v.checked).map((v) => v.id);
      const satisfied = validated.filter((v) => v.checked).map((v) => v.id);

      if (unsatisfied.length === 0 && nextCol) {
        // All criteria satisfied — advance the card.
        await updateTaskStatus(baseDir, task.id, nextCol.id);
        results.push({
          taskId: task.id,
          advanced: true,
          nextColumnId: nextCol.id,
          satisfiedCriteria: satisfied,
          unsatisfiedCriteria: [],
        });
      } else {
        // Hard-blocked.
        results.push({
          taskId: task.id,
          advanced: false,
          nextColumnId: nextCol?.id ?? null,
          satisfiedCriteria: satisfied,
          unsatisfiedCriteria: unsatisfied,
        });
      }
    }

    return Response.json(results);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
