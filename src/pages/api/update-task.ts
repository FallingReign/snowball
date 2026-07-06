import type { APIRoute } from "astro";
import { updateTaskStatus } from "../../../engine/tasks.ts";

/**
 * POST /api/update-task
 * Body: { taskId: string, newStatus: string }
 * Updates the task's status in .snowball/tasks/<taskId>.yaml.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { taskId?: string; newStatus?: string };
    const { taskId, newStatus } = body;
    if (!taskId || !newStatus) {
      return Response.json(
        { error: "taskId and newStatus are required" },
        { status: 400 },
      );
    }
    await updateTaskStatus(process.cwd(), taskId, newStatus);
    return new Response(null, { status: 204 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
