use crate::engine::{tasks, workflow};
use crate::engine::tasks::types::Task;

#[tauri::command]
pub fn list_tasks() -> Result<Vec<Task>, String> {
    let base = std::env::current_dir()
        .map_err(|e| format!("Cannot determine working directory: {}", e))?;
    let wf = workflow::load_workflow(&base)?;
    let valid_statuses = workflow::column_ids(&wf);
    tasks::load_tasks(&base, &valid_statuses)
}

#[tauri::command]
pub fn update_task_status(task_id: String, new_status: String) -> Result<(), String> {
    let base = std::env::current_dir()
        .map_err(|e| format!("Cannot determine working directory: {}", e))?;
    let wf = workflow::load_workflow(&base)?;
    let valid_statuses = workflow::column_ids(&wf);
    tasks::update_task_status(&base, &task_id, &new_status, &valid_statuses)
}
