# Snowball

A local-first, file-backed Kanban board built on **Deno Desktop** + **React** + **TypeScript**. Board state lives in `.snowball/` YAML files — no database, no server.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | [Deno Desktop](https://docs.deno.com/runtime/desktop/) (`deno desktop`, requires Deno ≥ 2.9) |
| Backend engine | TypeScript (Deno) — reads/writes `.snowball/*.yaml` |
| Frontend | React 19 + TypeScript — built by Vite |
| UI components | shadcn/ui (cascade-ui preset) + Tailwind CSS v4 |
| IPC | Deno Desktop `win.bind()` / webview `bindings.*` (in-process, no socket) |

## Prerequisites

- **Deno ≥ 2.9** — `~/.deno/bin/deno` (add to PATH: `export PATH="$HOME/.deno/bin:$PATH"`)
- **Node.js ≥ 20** + npm (for Vite and shadcn)

## Development

```bash
# Terminal 1: start the Vite frontend dev server (hot-reload)
npm run dev            # or: deno task dev:vite

# Terminal 2: start Deno Desktop (opens the window)
deno task dev
```

The Deno Desktop window opens and navigates to the Vite dev server at `http://localhost:5173`.
Changes to `src/` hot-reload via Vite; changes to `engine/` require restarting `deno task dev`.

## Production build

```bash
deno task build        # runs: npm run build && deno desktop --output dist/Snowball.exe main.ts
```

The compiled binary at `dist/Snowball.exe` is self-contained — it bundles Deno, the engine code, and the frontend assets.

## Tests

```bash
deno task test         # runs: deno test engine/
```

14 tests covering the engine (workflow validation, task validation, I/O round-trips).

## Project layout

```
.snowball/
  workflow.yaml        # column definitions, actor list
  tasks/
    *.yaml             # one file per task

engine/                # Deno-only backend (not bundled by Vite)
  types.ts             # raw YAML types + frontend camelCase types
  workflow.ts          # loadWorkflow, validateWorkflow, columnIds
  tasks.ts             # listTasks, validateTask, updateTaskStatus
  workflow_test.ts     # 6 Deno tests
  tasks_test.ts        # 8 Deno tests

src/                   # React frontend (bundled by Vite)
  lib/
    api.ts             # bindings bridge (replaces old tauri.ts)
    types.ts           # TypeScript interfaces for the frontend
  components/
    kanban/            # Board, Column, Card
    task/              # TaskDetail
    ui/                # shadcn/cascade-ui components

main.ts                # Deno Desktop entry point
deno.json              # Deno tasks + desktop config
vite.config.ts         # Vite config (React + Tailwind)
```

## How Deno Desktop IPC works

`main.ts` registers three bindings on the window:

```ts
win.bind("loadWorkflow", () => loadWorkflow(BASE_DIR));
win.bind("listTasks",    () => listTasks(BASE_DIR));
win.bind("updateTaskStatus", (id, status) => updateTaskStatus(BASE_DIR, id, status));
```

The React frontend calls them via the globally-injected `bindings` Proxy:

```ts
const workflow = await bindings.loadWorkflow();
const tasks    = await bindings.listTasks();
await bindings.updateTaskStatus(taskId, newStatus);
```

Arguments and return values cross the boundary as JSON. The bridge is in `src/lib/api.ts`.

## .snowball/ data format

**workflow.yaml**
```yaml
name: My Board
columns:
  - id: backlog
    name: Backlog
    wip_limit: null
  - id: done
    name: Done
    wip_limit: null
```

**tasks/my-task.yaml**
```yaml
id: my-task
title: Do something
status: backlog
actor: human
acceptance_criteria:
  - It works
```

