import type { RuntimeAdapter, CriterionToCheck } from "./runtime-adapter.ts";

/**
 * FakeRuntimeAdapter — simulates an agent column-owner deterministically.
 *
 * Machine exit criteria are always marked satisfied (checked = true).
 * Human exit criteria are returned unchanged — only a human can tick those.
 *
 * This exercises the full agent-owner -> validate -> gated-move path end-to-end
 * without any real AI.  A real adapter (pi, Copilot CLI, etc.) is Slice B.
 */
export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly name = "fake";

  async validateMachineCriteria(
    _taskId: string,
    _columnId: string,
    criteria: CriterionToCheck[],
  ): Promise<CriterionToCheck[]> {
    const now = new Date().toISOString();
    return criteria.map((c): CriterionToCheck => ({
      ...c,
      checked: c.kind === "machine" ? true : c.checked,
      checkedAt: c.kind === "machine" ? now : c.checkedAt,
    }));
  }
}
