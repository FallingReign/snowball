/**
 * src/lib/api.ts — HTTP API bridge for the React frontend.
 */

import type { Task, Workflow, CriterionCheck } from "./types";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return res;
}

export async function loadWorkflow(): Promise<Workflow> {
  const res = await apiFetch("/api/workflow");
  return res.json() as Promise<Workflow>;
}

export async function listTasks(): Promise<Task[]> {
  const res = await apiFetch("/api/tasks");
  return res.json() as Promise<Task[]>;
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
): Promise<void> {
  await apiFetch("/api/update-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, newStatus }),
  });
}

export interface ColumnConfigPayload {
  wip_limit?: number | null;
  owner?: {
    kind: "human" | "agent";
    role?: string;
    instances?: number;
    runtime?: "fake" | "copilot-cli";
    runtime_config?: {
      cli_path?: string;
      model?: string;
      timeout_ms?: number;
      instructions?: string;
    };
  };
  exit_criteria?: Array<{ id: string; description: string; kind: "machine" | "human" }>;
}

export async function updateColumnConfig(
  columnId: string,
  update: ColumnConfigPayload,
): Promise<void> {
  await apiFetch("/api/update-column", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columnId, ...update }),
  });
}

export async function updateCriteriaChecks(
  taskId: string,
  columnId: string,
  checks: CriterionCheck[],
): Promise<void> {
  await apiFetch("/api/update-criteria-checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, columnId, checks }),
  });
}

export interface AgentAdvanceResult {
  taskId: string;
  advanced: boolean;
  nextColumnId: string | null;
  satisfiedCriteria: string[];
  unsatisfiedCriteria: string[];
}

export async function agentAdvance(
  columnId: string,
): Promise<AgentAdvanceResult[]> {
  const res = await apiFetch("/api/agent-advance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columnId }),
  });
  return res.json() as Promise<AgentAdvanceResult[]>;
}

export async function fakeAgentAdvance(
  columnId: string,
): Promise<AgentAdvanceResult[]> {
  const res = await apiFetch("/api/fake-agent-advance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columnId }),
  });
  return res.json() as Promise<AgentAdvanceResult[]>;
}
