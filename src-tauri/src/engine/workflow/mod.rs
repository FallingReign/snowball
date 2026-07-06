pub mod types;

use std::collections::HashSet;
use std::path::Path;

use types::Workflow;

pub fn load_workflow(base_dir: &Path) -> Result<Workflow, String> {
    let path = base_dir.join(".snowball").join("workflow.yaml");
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
    let workflow: Workflow = serde_yaml::from_str(&content)
        .map_err(|e| format!("Cannot parse workflow.yaml: {}", e))?;
    validate_workflow(&workflow)?;
    Ok(workflow)
}

pub fn validate_workflow(workflow: &Workflow) -> Result<(), String> {
    if workflow.columns.is_empty() {
        return Err("workflow.yaml must define at least one column".to_string());
    }
    let mut seen = HashSet::new();
    for col in &workflow.columns {
        if col.id.is_empty() {
            return Err("every column must have a non-empty id".to_string());
        }
        if !seen.insert(col.id.clone()) {
            return Err(format!("duplicate column id: '{}'", col.id));
        }
    }
    Ok(())
}

pub fn column_ids(workflow: &Workflow) -> HashSet<String> {
    workflow.columns.iter().map(|c| c.id.clone()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::workflow::types::{Column, Workflow};

    fn make_workflow(cols: Vec<(&str, &str)>) -> Workflow {
        Workflow {
            name: "Test".to_string(),
            columns: cols
                .into_iter()
                .map(|(id, name)| Column { id: id.to_string(), name: name.to_string(), wip_limit: None })
                .collect(),
            actors: vec![],
            wip_limits: std::collections::HashMap::new(),
        }
    }

    #[test]
    fn valid_workflow_passes() {
        let w = make_workflow(vec![("backlog", "Backlog"), ("done", "Done")]);
        assert!(validate_workflow(&w).is_ok());
    }

    #[test]
    fn empty_columns_is_err() {
        let w = make_workflow(vec![]);
        assert!(validate_workflow(&w).is_err());
    }

    #[test]
    fn empty_column_id_is_err() {
        let w = make_workflow(vec![("", "No ID")]);
        assert!(validate_workflow(&w).is_err());
    }

    #[test]
    fn duplicate_column_id_is_err() {
        let w = make_workflow(vec![("backlog", "A"), ("backlog", "B")]);
        let err = validate_workflow(&w).unwrap_err();
        assert!(err.contains("duplicate"), "expected 'duplicate' in: {}", err);
    }

    #[test]
    fn column_ids_returns_all_ids() {
        let w = make_workflow(vec![("backlog", "Backlog"), ("done", "Done")]);
        let ids = column_ids(&w);
        assert!(ids.contains("backlog"));
        assert!(ids.contains("done"));
        assert_eq!(ids.len(), 2);
    }
}
