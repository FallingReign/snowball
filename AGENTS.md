# AGENTS.md — Snowball project memory

Durable knowledge for autonomous agents working on this repo.

## Platform: Deno Desktop (as of Slice 1, 2026-07)

Snowball runs as a **Deno Desktop** app (requires Deno ≥ 2.9).

- Deno binary: `~/.deno/bin/deno`; add to PATH if missing: `export PATH="$HOME/.deno/bin:$PATH"`
- Entry point: `main.ts` (explicit entry, NOT auto-detected — we use bindings)
- Config: `deno.json` (tasks + `desktop` block with app name, identifier, icons)

### Why explicit entry (not auto-detection)

`deno desktop .` would auto-detect the Vite project and serve `dist/` — but it
generates a synthetic entry that cannot register `win.bind()` bindings. We pass
`deno desktop main.ts` explicitly so we can wire up the TS engine functions
before the webview loads.

### IPC model

Deno Desktop uses **in-process bindings** (not socket IPC):

- **Backend** (`main.ts`): `win.bind("name", handler)` — runs in Deno runtime
- **Frontend** (`src/lib/api.ts`): `bindings.name(args)` — Proxy injected into
  the webview before page load by Deno Desktop

Arguments and return values are JSON-serialised. Only plain data is safe:
strings, numbers, booleans, plain objects/arrays, null. No Date, Map, Set, etc.

### Dev workflow (two terminals)

```bash
# Terminal 1
npm run dev            # Vite on :5173

# Terminal 2
deno task dev          # SNOWBALL_DEV_URL=http://localhost:5173 deno desktop main.ts
```

`SNOWBALL_DEV_URL` is the flag that switches `main.ts` between dev (navigates
the window to Vite) and prod (starts `Deno.serve()` on a random port to serve
`dist/`).

### Build & test

```bash
deno task build        # npm run build + deno desktop --output dist/Snowball.exe main.ts
deno task test         # deno test engine/
```

## Engine layout

```
engine/
  types.ts          # RawWorkflow/RawTask (snake_case YAML) + Workflow/Task (camelCase frontend)
  workflow.ts       # loadWorkflow(), loadRawWorkflow(), validateWorkflow(), columnIds()
  tasks.ts          # listTasks(), validateTask(), updateTaskStatus()
  workflow_test.ts  # 6 deno tests
  tasks_test.ts     # 8 deno tests
```

The engine is **Deno-only** (not imported by Vite). Vite only bundles `src/`.

### Engine conventions

- `loadRawWorkflow(baseDir)` — used internally by both `loadWorkflow` and `updateTaskStatus` / `listTasks`
- `BASE_DIR = Deno.cwd()` — in dev this is the repo root; production binaries
  should eventually embed the path or accept it as an argument
- YAML files use snake_case; frontend types use camelCase; conversion happens in `engine/`

## Frontend

- `src/lib/api.ts` — public bindings bridge (same API as old `tauri.ts`)
- `src/lib/types.ts` — TypeScript interfaces (camelCase); match `engine/types.ts` frontend types
- `src/App.tsx` imports from `./lib/api` (not `./lib/tauri`)
- No Tauri SDK anywhere in the codebase

## cascade-ui / shadcn components

Components in `src/components/ui/` came from the cascade-ui shadcn registry.
To add more: `npx shadcn@latest add FallingReign/cascade-ui/<component>`.
Do NOT vendor or hot-serve a local registry.

## What's out of scope (Slice 1)

- Drag-and-drop, WIP enforcement UI, task-detail polish → Slice 2
- Agent/worker/Copilot-CLI features → far-future

