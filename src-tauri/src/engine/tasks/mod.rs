pub mod types;

use std::collections::HashSet;
use std::path::Path;

use types::Task;

pub fn load_tasks(base_dir: &Path, valid_statuses: &HashSet<String>) -> Result<Vec<Task>, String> {
    let tasks_dir = base_dir.join(".snowball").join("tasks");
    let mut entries: Vec<_> = std::fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Cannot read tasks directory {}: {}", tasks_dir.display(), e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map_or(false, |x| x == "yaml" || x == "yml")
        })
        .collect();
    // sort by filename for determinism
    entries.sort_by_key(|e| e.file_name());

    let mut tasks = Vec::new();
    for entry in entries {
        let path = entry.path();
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
        let task: Task = serde_yaml::from_str(&content)
            .map_err(|e| format!("Cannot parse {}: {}", path.display(), e))?;
        validate_task(&task, valid_statuses, &path.display().to_string())?;
        tasks.push(task);
    }
    // secondary sort by id for stable ordering regardless of filename
    tasks.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(tasks)
}

pub fn validate_task(task: &Task, valid_statuses: &HashSet<String>, source: &str) -> Result<(), String> {
    if task.id.is_empty() {
        return Err(format!("{}: task id must not be empty", source));
    }
    if task.title.is_empty() {
        return Err(format!("{}: task '{}' title must not be empty", source, task.id));
    }
    if !valid_statuses.contains(&task.status) {
        let mut sorted: Vec<_> = valid_statuses.iter().collect();
        sorted.sort();
        return Err(format!(
            "{}: task '{}' has unknown status '{}'; valid statuses: {:?}",
            source, task.id, task.status, sorted
        ));
    }
    Ok(())
}

/// Updates the `status` field in the task YAML file identified by `task_id`.
/// Reads and writes via serde_yaml::Value to preserve all other fields and key naming.
pub fn update_task_status(
    base_dir: &Path,
    task_id: &str,
    new_status: &str,
    valid_statuses: &HashSet<String>,
) -> Result<(), String> {
    if !valid_statuses.contains(new_status) {
        let mut sorted: Vec<_> = valid_statuses.iter().collect();
        sorted.sort();
        return Err(format!(
            "status '{}' is not a valid workflow column; valid statuses: {:?}",
            new_status, sorted
        ));
    }
    let path = base_dir
        .join(".snowball")
        .join("tasks")
        .join(format!("{}.yaml", task_id));
    if !path.exists() {
        return Err(format!("task '{}' not found (expected {})", task_id, path.display()));
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    let mut doc: serde_yaml::Value = serde_yaml::from_str(&content)
        .map_err(|e| format!("Cannot parse {}: {}", path.display(), e))?;
    doc["status"] = serde_yaml::Value::String(new_status.to_string());
    let new_content = serde_yaml::to_string(&doc)
        .map_err(|e| format!("Cannot serialize task '{}': {}", task_id, e))?;
    std::fs::write(&path, new_content)
        .map_err(|e| format!("Cannot write {}: {}", path.display(), e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn statuses(s: &[&str]) -> HashSet<String> {
        s.iter().map(|x| x.to_string()).collect()
    }

    fn make_task(id: &str, title: &str, status: &str) -> Task {
        Task {
            id: id.to_string(),
            title: title.to_string(),
            status: status.to_string(),
            actor: None,
            acceptance_criteria: vec![],
            exit_criteria: vec![],
            event_log: vec![],
        }
    }

    #[test]
    fn valid_task_passes() {
        let cols = statuses(&["backlog", "done"]);
        let t = make_task("t1", "My Task", "backlog");
        assert!(validate_task(&t, &cols, "test").is_ok());
    }

    #[test]
    fn empty_id_is_err() {
        let cols = statuses(&["backlog"]);
        let t = make_task("", "Title", "backlog");
        assert!(validate_task(&t, &cols, "test").is_err());
    }

    #[test]
    fn empty_title_is_err() {
        let cols = statuses(&["backlog"]);
        let t = make_task("t1", "", "backlog");
        assert!(validate_task(&t, &cols, "test").is_err());
    }

    #[test]
    fn unknown_status_is_err() {
        let cols = statuses(&["backlog", "done"]);
        let t = make_task("t1", "Title", "nonexistent");
        let err = validate_task(&t, &cols, "test").unwrap_err();
        assert!(err.contains("nonexistent"), "expected status name in: {}", err);
    }

    #[test]
    fn update_rejects_invalid_status() {
        let cols = statuses(&["backlog", "done"]);
        let base = Path::new(".");
        let err = update_task_status(base, "some-task", "invalid", &cols).unwrap_err();
        assert!(err.contains("invalid"), "expected status name in: {}", err);
    }

    #[test]
    fn update_rejects_missing_task() {
        let cols = statuses(&["backlog", "done"]);
        let base = Path::new(".");
        // "nonexistent-task-xyz.yaml" won't exist
        let err = update_task_status(base, "nonexistent-task-xyz", "backlog", &cols).unwrap_err();
        assert!(err.contains("not found"), "expected 'not found' in: {}", err);
    }
}
