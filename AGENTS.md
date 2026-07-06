# AGENTS.md — Snowball project memory

Durable knowledge for autonomous agents working on this repo.

## Platform: Deno Desktop + Astro SSR (as of Slice 1 / Astro follow-up, 2026-07)

Snowball runs as a **Deno Desktop** app (requires Deno ≥ 2.9).

- Deno binary: `~/.deno/bin/deno`; add to PATH if missing: `export PATH="$HOME/.deno/bin:$PATH"`
- Framework: **Astro 7** with `output: "server"` + `@astrojs/node` adapter
- **Auto-detection**: `deno desktop .` finds `astro.config.mjs` → detects Astro → runs
  `dist/server/entry.mjs` (node standalone server) via Deno's Node.js compat layer
- No custom `main.ts` entry point — the Deno Desktop synthesises one from Astro's output

### Why Astro SSR (not static)

Static Astro + Deno Desktop auto-detection serves `dist/` directly with no
server-side code. That means no API routes, which means the React islands can't
call the Deno engine. SSR mode gives us API routes server-side.

### Data flow

```
Browser (React island)
  → fetch("/api/workflow" | "/api/tasks" | "/api/update-task")
  → Astro API route (src/pages/api/)   [runs server-side, inside Deno]
  → engine function (engine/)          [reads/writes .snowball/ YAML]
  → JSON response
```

### Deno polyfill shim (in astro.config.mjs)

The engine uses `Deno.readTextFile`, `Deno.readDir`, etc. Those are native Deno
APIs unavailable in Node.js. Astro dev mode (`astro dev`) runs the SSR modules
in Node.js (Vite). A shim is installed at config-load time and via the
`configureServer` Vite plugin hook:

```ts
globalThis.Deno = {
  readTextFile: (p) => readFile(p, 'utf-8'),
  writeTextFile: (p, data) => writeFile(p, data),
  stat: (p) => stat(p),
  readDir(p) { /* async generator over readdir() */ },
};
```

In production (Deno Desktop runs `dist/server/entry.mjs` with real Deno), the
shim is a no-op because `globalThis.Deno` is already the native Deno namespace.

### jsr:@std/yaml alias

The engine imports `jsr:@std/yaml` (Deno JSR). Vite can't resolve `jsr:` URLs.
`astro.config.mjs` aliases it to `node_modules/yaml/browser/dist/index.js` (the
ESM browser build of the `yaml` npm package, which has the same `parse`/`stringify` API):

```js
"jsr:@std/yaml": path.resolve(__dirname, "node_modules/yaml/browser/dist/index.js")
```

Deno tests still use `jsr:@std/yaml@^1` (via `deno.json` imports map) so the
engine files need not change.

### Run / build commands

```bash
deno task dev       # astro dev via deno desktop --hmr  (HMR, port 4321)
npm run dev         # astro dev standalone (no Deno Desktop window, browser only)
deno task test      # deno test engine/  (14 tests)
npm run build       # astro build → dist/
deno task build     # npm run build + deno desktop --output dist/Snowball.exe .
deno task start     # npm run build + deno desktop .  (run prod locally)
```

### Permissions required

`--allow-read --allow-write --allow-env --allow-net --allow-sys`

The `--allow-sys` flag is needed for `@astrojs/node`'s `os.networkInterfaces()`
logging call.

## Engine layout (unchanged)

```
engine/
  types.ts          # RawWorkflow/RawTask (snake_case) + Workflow/Task (camelCase)
  workflow.ts       # loadWorkflow(), loadRawWorkflow(), validateWorkflow(), columnIds()
  tasks.ts          # listTasks(), validateTask(), updateTaskStatus()
  workflow_test.ts  # 6 deno tests
  tasks_test.ts     # 8 deno tests
```

Engine is **Deno-only** (not imported by Vite client bundle; imported by API routes
which bundle into the SSR server chunk where Deno APIs are available at runtime).

### Engine conventions

- `BASE_DIR = process.cwd()` in API routes (works in both Node.js and Deno)
- YAML files use snake_case; frontend types use camelCase; conversion in engine

## Frontend

- `src/pages/index.astro` — shell page; mounts `<App client:only="react" />`
- `src/pages/api/` — server-side API routes
- `src/lib/api.ts` — fetch-based bridge (same public API surface as the old bindings bridge)
- `src/App.tsx` — root React island (unchanged; imports from `./lib/api`)
- `src/components/*` — all React components (completely unchanged)
- `src/lib/types.ts` — TypeScript interfaces (unchanged)

## Durable UI principle

**Reuse existing components; never hand-roll a bespoke component per feature.**
cascade-ui (`FallingReign/cascade-ui`) is the preferred source but is missing
most components we need. If it cannot cover a need, we will stand up a consistent
local component library later — do NOT invent one-off components per feature.
To add cascade-ui components: `npx shadcn@latest add FallingReign/cascade-ui/<component>`.

## Slice 2 additions (Drag-and-drop / board interactions, 2026-07)

- **Drag-and-drop**: `@dnd-kit/core` (+ `@dnd-kit/utilities` which ships as a
  transitive dep). Cards are `useDraggable`; columns are `useDroppable`.
  `DndContext` lives in `Board` with a single `onDragEnd` handler.
- **WIP enforcement** is done client-side in `onDragEnd`: if the target column
  is at its `wipLimit`, the drop is silently blocked (card snaps back). The
  column turns red (`border-destructive / bg-destructive/10`) when `atLimit`.
- **Task detail**: already present from Slice 1; shows title, status (editable
  via dropdown), actor, acceptance criteria, exit criteria, event log.
- `Board` now accepts `onMove: (taskId, newStatus) => Promise<void>` —
  threaded from `App.tsx`'s `handleMove` through `DndContext.onDragEnd`.
  Keep the signature open to non-human initiators (don't add `initiator` yet;
  it can be added when agent moves are needed).

## What's out of scope (Slice 1 + Astro follow-up)

- Agent/worker/Copilot-CLI features → far-future YAGNI
