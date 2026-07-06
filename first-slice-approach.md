# First Slice: Execution Approach

Covers Phase 0 + Phase 1 from the roadmap: Release 0.1, the board seed.

## Goal

Smallest useful Snowball: a Tauri app that manages its own `.snowball/` tasks on a rendered Kanban board. Dogfooding starts as soon as that works.

## In

- Tauri v2 + React/TypeScript shell
- Tailwind v4 + shadcn/cascade-ui
- `.snowball/workflow.yaml`
- `.snowball/tasks/*.yaml`
- Rust workflow/task loading, validation, and task status persistence
- Board, columns, cards, and task detail
- Manual status movement

## Out, but still on the roadmap

- Snowball agent panel and context packer
- Worker execution and Copilot CLI adapter
- Git worktrees
- Diff viewer, check runner, PR output
- Bottleneck detection and workflow suggestions
- Objective/hierarchy layer
- Database, queues, multi-user, auth, plugin marketplace

## cascade-ui

Use the GitHub shadcn registry directly:

```bash
npx shadcn@latest add FallingReign/cascade-ui/cascade-theme
npx shadcn@latest add FallingReign/cascade-ui/app-shell
```

No local hot-serving, npm package, or submodule.

## Done when

- `workflow.yaml` changes can affect the board without code changes
- Adding a task YAML creates a card
- Moving a task updates its YAML status
- Task detail shows acceptance criteria, exit criteria, actor, and event log
- Snowball's own backlog lives in `.snowball/tasks/`
