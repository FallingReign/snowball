import type { APIRoute } from "astro";
import { listTasks } from "../../../engine/tasks.ts";

/**
 * GET /api/tasks
 * Returns all tasks as a JSON array, sorted by id.
 */
export const GET: APIRoute = async () => {
  try {
    const tasks = await listTasks(process.cwd());
    return Response.json(tasks);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
