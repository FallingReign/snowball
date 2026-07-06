# Snowball

A local-first, file-backed Kanban board built on **Deno Desktop** + **Astro** + **React**.
Board state lives in `.snowball/` YAML files — no database, no cloud.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | [Deno Desktop](https://docs.deno.com/runtime/desktop/) (`deno desktop`, requires Deno ≥ 2.9) |
| Frontend framework | [Astro 7](https://astro.build/) with SSR (`@astrojs/node` adapter) |
| UI components | React 19 islands (`@astrojs/react`) — existing components reused as-is |
| Styling | Tailwind CSS v4 (cascade-ui preset via `shadcn`) |
| API layer | Astro server-side API routes (`src/pages/api/`) calling the TS engine |
| Backend engine | TypeScript (Deno) — reads/writes `.snowball/*.yaml` |

## How Deno Desktop auto-detects Astro

`deno desktop .` detects the project as Astro via `astro.config.mjs`, builds
the synthetic entry point that imports `dist/server/entry.mjs` (the
`@astrojs/node` standalone server), and navigates the webview to the bound
port. No custom `main.ts` required.

## Prerequisites

- **Deno ≥ 2.9** — typically at `~/.deno/bin/deno`; add to PATH:
  ```bash
  export PATH="$HOME/.deno/bin:$PATH"
  ```
- **Node.js ≥ 20** + npm (for Astro and npm packages)

## Development

```bash
# Run the Astro dev server with Deno Desktop HMR (single command)
deno task dev
# Equivalent: deno desktop --hmr --allow-read --allow-write --allow-env --allow-net --allow-sys .
```

Deno Desktop auto-detects Astro and starts `astro dev` internally. The board
is available at `http://localhost:4321` in the webview and in a browser.

> **Note on Astro dev in isolation**: You can also run `npm run dev` directly
> (without Deno Desktop) and open `http://localhost:4321` in a browser for
> pure frontend development. API routes work because the Astro dev server
> includes a Deno polyfill shim (in `astro.config.mjs`) that satisfies the
> engine's `Deno.*` calls using `node:fs/promises`.

## Production

```bash
npm run build          # astro build → dist/server/entry.mjs + dist/client/
deno desktop --allow-read --allow-write --allow-env --allow-net --allow-sys .
# or compile to a self-contained binary:
deno task build        # → dist/Snowball.exe
```

## Tests

```bash
deno task test         # deno test engine/  (14 tests)
```

## Project layout

```
.snowball/
  workflow.yaml        # column definitions (id, name, wip_limit)
  tasks/
    *.yaml             # one file per task

engine/                # Deno-only backend; unchanged by this migration
  types.ts             # raw YAML types (snake_case) + frontend types (camelCase)
  workflow.ts          # loadWorkflow, validateWorkflow, columnIds
  tasks.ts             # listTasks, validateTask, updateTaskStatus
  workflow_test.ts     # 6 Deno tests
  tasks_test.ts        # 8 Deno tests

src/
  pages/
    index.astro        # Main page — renders App as a client:only React island
    api/
      workflow.ts      # GET  /api/workflow   → engine.loadWorkflow()
      tasks.ts         # GET  /api/tasks      → engine.listTasks()
      update-task.ts   # POST /api/update-task → engine.updateTaskStatus()
  components/
    kanban/            # Board, Column, Card — React components (unchanged)
    task/              # TaskDetail — React component (unchanged)
    ui/                # shadcn/cascade-ui components (unchanged)
  lib/
    api.ts             # Fetch-based bridge (replaces old bindings-based bridge)
    types.ts           # TypeScript interfaces for the frontend
  App.tsx              # Root React component, rendered as client:only island

astro.config.mjs       # Astro config (SSR, @astrojs/react, Tailwind, Deno shim)
deno.json              # Deno tasks + desktop config
package.json           # npm deps (Astro, React, Tailwind, yaml)
```

## Data flow

```
Browser (React island)
  → fetch("/api/workflow")
  → Astro API route (src/pages/api/workflow.ts)  [server-side, in Deno]
  → engine.loadWorkflow(process.cwd())            [reads .snowball/workflow.yaml]
  → JSON response
```

## .snowball/ format

**workflow.yaml**
```yaml
name: My Board
columns:
  - id: backlog
    name: Backlog
    wip_limit: null
  - id: done
    name: Done
    wip_limit: 5
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
