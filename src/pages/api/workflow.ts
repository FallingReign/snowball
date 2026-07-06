import type { APIRoute } from "astro";
import { loadWorkflow } from "../../../engine/workflow.ts";

/**
 * GET /api/workflow
 * Returns the parsed Workflow (columns, actors, wipLimits) as JSON.
 * Runs server-side inside Deno Desktop's Deno runtime, so Deno.* APIs
 * (used by the engine) are available.
 */
export const GET: APIRoute = async () => {
  try {
    const workflow = await loadWorkflow(process.cwd());
    return Response.json(workflow);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
