use serde::{Deserialize, Serialize};

// serialize = camelCase for Tauri/JSON; deserialize = snake_case for YAML files.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub actor: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub exit_criteria: Vec<String>,
    #[serde(default)]
    pub event_log: Vec<EventEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct EventEntry {
    pub timestamp: String,
    pub message: String,
}
