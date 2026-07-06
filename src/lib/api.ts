/**
 * src/lib/api.ts — HTTP API bridge for the React frontend.
 *
 * Replaces the old Deno Desktop bindings bridge. The React islands call
 * these functions; they delegate to Astro API routes via fetch. The Astro
 * server routes call the TypeScript engine server-side (in Deno Desktop's
 * Deno runtime), which reads/writes the .snowball/ YAML files.
 *
 * All paths are relative to the server origin so they work in both dev
 * (astro dev on :4321) and production (deno desktop . running dist/).
 */

import type { Task, Workflow } from "./types";

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
