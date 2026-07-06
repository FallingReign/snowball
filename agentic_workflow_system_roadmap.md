# Snowball Agentic Workflow System Roadmap

This roadmap keeps the full product direction visible while the build stays YAGNI: board first, dogfood immediately, agents only after the file-backed workflow proves useful.

## Principle

Snowball is a local-first agentic workflow app. The smallest useful version is not worker automation; it is a reliable board backed by files that can manage Snowball's own work.

## Release 0.1: Board seed

Status: in progress / first slice built.

Scope:

- Tauri v2 + React/TypeScript shell
- Tailwind v4 + shadcn/cascade-ui visual baseline
- `.snowball/workflow.yaml` as workflow source of truth
- `.snowball/tasks/*.yaml` as task source of truth
- Rust workflow/task loading and validation
- Board rendering from workflow columns and task statuses
- Task detail panel
- Manual task status movement that persists to YAML

Done when:

- Editing `workflow.yaml` can change the board without code changes
- Adding a task YAML creates a card
- Moving a task updates that task YAML
- Snowball's own work is tracked in `.snowball/tasks/`

## Release 0.2: Better manual workflow

Only after 0.1 is dogfooded.

- WIP-limit warnings
- Better task detail editing if manual YAML editing hurts
- Event log display polish
- Empty/error states
- Minimal workflow health indicators based on real dogfood pain

## Release 0.3: Agent read path

No worker execution yet.

- Context packer design gate
- Agent can answer questions about current workflow, tasks, blocked work, and next actions
- Token budget and truncation rules documented before implementation
- Read-only agent panel

## Release 0.4: Worker execution spike

Only after the read path proves useful.

- Copilot CLI/headless worker spike
- Structured input/output contract
- Timeout and failure handling
- No PR automation until worker output is reviewable and repeatable

## Release 0.5: Worker review loop

- Isolated work execution
- Diff visibility
- Check runner
- Human review gate
- Optional PR creation only if dogfooding proves it saves time

## Later, kept on roadmap

- Bottleneck detection
- Workflow improvement suggestions
- Objective/hierarchy layer above tasks
- Git worktree management beyond the worker spike
- Database if file-backed state becomes the bottleneck
- Multi-user/auth/plugin marketplace

## cascade-ui

Use the public GitHub shadcn registry directly:

```bash
npx shadcn@latest add FallingReign/cascade-ui/cascade-theme
npx shadcn@latest add FallingReign/cascade-ui/app-shell
```

Do not hot-serve the registry locally. Do not create a separate Snowball UI registry until there is real duplication to extract.

## Current cut line

Do not build agents, workers, PR automation, bottleneck detection, or hierarchy until the board has managed real Snowball work and exposed a concrete pain.
