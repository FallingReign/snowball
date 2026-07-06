import { invoke } from "@tauri-apps/api/core";
import type { Task, Workflow } from "./types";

export async function loadWorkflow(): Promise<Workflow> {
  return invoke<Workflow>("load_workflow");
}

export async function listTasks(): Promise<Task[]> {
  return invoke<Task[]>("list_tasks");
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: string
): Promise<void> {
  return invoke<void>("update_task_status", { taskId, newStatus });
}
