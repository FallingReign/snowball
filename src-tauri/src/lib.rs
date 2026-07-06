mod commands;
mod engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::workflow::load_workflow,
            commands::tasks::list_tasks,
            commands::tasks::update_task_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
