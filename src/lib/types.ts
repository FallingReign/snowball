export interface Workflow {
  name: string;
  columns: Column[];
  actors: Actor[];
  wipLimits: Record<string, number>;
}

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

export interface Task {
  id: string;
  title: string;
  status: string;
  actor: string | null;
  acceptanceCriteria: string[];
  exitCriteria: string[];
  eventLog: EventEntry[];
}

export interface EventEntry {
  timestamp: string;
  message: string;
}
