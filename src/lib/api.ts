/**
 * src/lib/api.ts — Deno Desktop bindings bridge
 *
 * Deno Desktop injects a `bindings` Proxy into the webview's global scope.
 * Each property access on the Proxy returns a function that, when called,
 * forwards the invocation to the matching win.bind(name, handler) registered
 * in main.ts, crossing the Deno <-> webview boundary over an in-process channel.
 *
 * Arguments and return values are JSON-serialised (plain data only — no Date,
 * Map, Set, class instances; stick to the interfaces in types.ts).
 */

import type { Task, Workflow } from "./types";

// ---------------------------------------------------------------------------
// TypeScript declaration for the Deno Desktop `bindings` global.
// The runtime object is injected before the page loads; this declaration
// purely gives the TypeScript compiler type information.
// ---------------------------------------------------------------------------
declare global {
  // deno-lint-ignore no-var
  var bindings: {
    loadWorkflow(): Promise<Workflow>;
    listTasks(): Promise<Task[]>;
    updateTaskStatus(taskId: string, newStatus: string): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Public API — identical signatures to the old tauri.ts; no App.tsx changes.
// ---------------------------------------------------------------------------

export async function loadWorkflow(): Promise<Workflow> {
  return globalThis.bindings.loadWorkflow();
}

export async function listTasks(): Promise<Task[]> {
  return globalThis.bindings.listTasks();
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
): Promise<void> {
  return globalThis.bindings.updateTaskStatus(taskId, newStatus);
}
