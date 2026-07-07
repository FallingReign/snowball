// ---------------------------------------------------------------------------
// Raw YAML schema types (snake_case — mirrors the .snowball/ file format)
// ---------------------------------------------------------------------------

export interface RawColumnOwner {
  kind: "human" | "agent";
  role?: string;       // only when kind === "agent"
  instances?: number;  // only when kind === "agent"; default 1
}

export interface RawExitCriterion {
  id: string;
  description: string;
  kind: "machine" | "human";
}

export interface RawColumn {
  id: string;
  name: string;
  wip_limit?: number | null;
  owner?: RawColumnOwner;              // default: { kind: "human" }
  exit_criteria?: RawExitCriterion[];  // default: []
  links_to?: string | null;            // reserved — board layering (Slice B+); not built
}

export interface RawActor {
  id: string;
  name: string;
  kind: "human" | "agent";
}

export interface RawWorkflow {
  name: string;
  columns: RawColumn[];
  actors?: RawActor[];
  wip_limits?: Record<string, number>;
}

export interface RawCriterionCheck {
  column_id: string;
  criterion_id: string;
  checked: boolean;
  checked_at?: string;
}

export interface RawEventEntry {
  timestamp: string;
  message: string;
}

export interface RawTask {
  id: string;
  title: string;
  status: string;
  actor?: string;
  acceptance_criteria?: string[];
  exit_criteria?: string[];               // legacy plain-string list (kept for backward compat)
  criteria_checks?: RawCriterionCheck[];  // per-card per-column exit-criteria check state
  event_log?: RawEventEntry[];
}

// ---------------------------------------------------------------------------
// Frontend types (camelCase — returned to the webview via API routes)
// These mirror src/lib/types.ts exactly so the frontend can import either.
// ---------------------------------------------------------------------------

export interface ColumnOwner {
  kind: "human" | "agent";
  role?: string;      // only when kind === "agent"
  instances: number;  // always present (default 1)
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

export interface Actor {
  id: string;
  name: string;
  kind: "human" | "agent";
}

export interface Workflow {
  name: string;
  columns: Column[];
  actors: Actor[];
  wipLimits: Record<string, number>;
}

export interface CriterionCheck {
  columnId: string;
  criterionId: string;
  checked: boolean;
  checkedAt?: string;
}

export interface EventEntry {
  timestamp: string;
  message: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  actor: string | null;
  acceptanceCriteria: string[];
  exitCriteria: string[];          // legacy plain list (kept for backward compat)
  criteriaChecks: CriterionCheck[];
  eventLog: EventEntry[];
}
