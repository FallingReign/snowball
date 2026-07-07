import type { APIRoute } from "astro";
import { updateCriteriaChecks } from "../../../engine/tasks.ts";
import type { CriterionCheck } from "../../../engine/types.ts";

/**
 * POST /api/update-criteria-checks
 * Body: { taskId, columnId, checks: CriterionCheck[] }
 * Persists per-card exit-criteria check state for a given (task, column) pair.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      taskId?: string;
      columnId?: string;
      checks?: CriterionCheck[];
    };
    const { taskId, columnId, checks } = body;
    if (!taskId || !columnId || !Array.isArray(checks)) {
      return Response.json(
        { error: "taskId, columnId and checks[] are required" },
        { status: 400 },
      );
    }
    await updateCriteriaChecks(process.cwd(), taskId, columnId, checks);
    return new Response(null, { status: 204 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
