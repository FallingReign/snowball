/**
 * RuntimeAdapter — minimal interface for Snowball column-owner agents.
 *
 * Modelled on floe-substrate's RuntimeAdapter shape but stripped to only
 * what Snowball needs.  Real adapters (pi, Copilot CLI, etc.) are Slice B —
 * only the FakeRuntimeAdapter is built here.
 */

export interface CriterionToCheck {
  id: string;
  kind: "machine" | "human";
  checked: boolean;
  checkedAt?: string;
}

export interface RuntimeAdapter {
  readonly name: string;

  /**
   * Validate machine exit criteria for a task in a given column.
   *
   * The adapter may inspect the task, call external tools, run tests, etc.
   * Returns the full updated set of criteria — machine criteria will have
   * checked: true (and a checkedAt timestamp); human criteria are returned unchanged.
   */
  validateMachineCriteria(
    taskId: string,
    columnId: string,
    criteria: CriterionToCheck[],
  ): Promise<CriterionToCheck[]>;
}
