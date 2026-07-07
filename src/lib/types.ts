export interface RuntimeConfig {
  cliPath?: string;
  model?: string;
  timeoutMs?: number;
  instructions?: string;
}

export interface ColumnOwner {
  kind: "human" | "agent";
  role?: string;      // only when kind === "agent"
  instances: number;  // always present (default 1)
  runtime: "fake" | "copilot-cli";  // always present (default "fake")
  runtimeConfig: RuntimeConfig;     // always present (default {})
}

export interface ExitCriterion {
  id: string;
  description: string;
  kind: "machine" | "human";
}

export interface Column {
  id: string;
  name: string;
  wipLimit: number | null;
  owner: ColumnOwner;
  exitCriteria: ExitCriterion[];
  linksTo: string | null;  // reserved — always null until board layering is built
}

export interface Workflow {
  name: string;
  columns: Column[];
  actors: Actor[];
  wipLimits: Record<string, number>;
}

export interface Actor {
  id: string;
  name: string;
  kind: "human" | "agent";
}

export interface CriterionCheck {
  columnId: string;
  criterionId: string;
  checked: boolean;
  checkedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  actor: string | null;
  acceptanceCriteria: string[];
  exitCriteria: string[];          // legacy plain list
  criteriaChecks: CriterionCheck[];
  eventLog: EventEntry[];
}

export interface EventEntry {
  timestamp: string;
  message: string;
}
