use crate::engine::workflow::{self, types::Workflow};

#[tauri::command]
pub fn load_workflow() -> Result<Workflow, String> {
    let base = std::env::current_dir()
        .map_err(|e| format!("Cannot determine working directory: {}", e))?;
    workflow::load_workflow(&base)
}
