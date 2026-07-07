import type { APIRoute } from "astro";
import { loadRawWorkflow } from "../../../engine/workflow.ts";
import { runAgentOnColumn } from "../../../engine/agent-runner.ts";
import { createAdapter } from "../../../engine/adapter-factory.ts";

/**
 * POST /api/agent-advance
 * Body: { columnId }
 *
 * Runs the configured RuntimeAdapter (fake or copilot-cli, per column owner
 * config) on every task in the given agent-owned column.
 *
 * Adapter is selected from the column's `owner.runtime` field:
 *   - "fake"        → FakeRuntimeAdapter (always marks machine criteria checked)
 *   - "copilot-cli" → CopilotCliAdapter (drives `gh copilot suggest` headless)
 *
 * Advancement is hard-gated: a card moves only when ALL exit criteria are
 * satisfied (machine criteria validated by adapter, human criteria checked
 * manually by a human).
 *
 * Returns an array of AgentAdvanceResult per task in the column.
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

    const col = raw.columns.find((c) => c.id === columnId);
    if (!col) {
      return Response.json({ error: `column '${columnId}' not found` }, { status: 404 });
    }
    if (!col.owner || col.owner.kind !== "agent") {
      return Response.json(
        { error: `column '${columnId}' is not agent-owned` },
        { status: 400 },
      );
    }

    const adapter = createAdapter(col.owner);
    const results = await runAgentOnColumn(baseDir, columnId, adapter);
    return Response.json(results);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
