use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// serialize = camelCase for Tauri/JSON; deserialize = snake_case for YAML files.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Workflow {
    pub name: String,
    pub columns: Vec<Column>,
    #[serde(default)]
    pub actors: Vec<Actor>,
    #[serde(default)]
    pub wip_limits: HashMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Column {
    pub id: String,
    pub name: String,
    pub wip_limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Actor {
    pub id: String,
    pub name: String,
    pub kind: ActorKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActorKind {
    Human,
    Agent,
}
