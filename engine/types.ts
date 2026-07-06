// ---------------------------------------------------------------------------
// Raw YAML schema types (snake_case — mirrors the .snowball/ file format)
// ---------------------------------------------------------------------------

export interface RawColumn {
  id: string;
  name: string;
  wip_limit?: number | null;
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
  exit_criteria?: string[];
  event_log?: RawEventEntry[];
}

// ---------------------------------------------------------------------------
// Frontend types (camelCase — returned to the webview via bindings)
// These mirror src/lib/types.ts exactly so the frontend can import either.
// ---------------------------------------------------------------------------

export interface Column {
  id: string;
  name: string;
  wipLimit: number | null;
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
  exitCriteria: string[];
  eventLog: EventEntry[];
}
