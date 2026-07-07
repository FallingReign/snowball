import type { APIRoute } from "astro";
import { updateColumnConfig } from "../../../engine/workflow.ts";
import type { RawColumnOwner, RawExitCriterion } from "../../../engine/types.ts";

/**
 * POST /api/update-column
 * Body: { columnId, wip_limit?, owner?, exit_criteria? }
 * Updates the column's owner, WIP limit, and/or exit criteria in workflow.yaml.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      columnId?: string;
      wip_limit?: number | null;
      owner?: RawColumnOwner;
      exit_criteria?: RawExitCriterion[];
    };
    const { columnId, ...update } = body;
    if (!columnId) {
      return Response.json({ error: "columnId is required" }, { status: 400 });
    }
    await updateColumnConfig(process.cwd(), columnId, update);
    return new Response(null, { status: 204 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
