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
  → fetch("/api/workflow" | "/api/tasks" | "/api/update-task" | ...)
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
npm install         # install node_modules (required on fresh checkout before any build)
deno task dev       # npm run build + deno desktop --hmr  (builds then opens window)
npm run dev         # astro dev standalone (no Deno Desktop window, browser only)
deno task test      # deno test engine/  (23 tests as of Slice A)
npm run build       # astro build → dist/
deno task build     # npm run build + deno desktop --output dist/Snowball.exe .
deno task start     # npm run build + deno desktop .  (run prod locally)
```

### Dev workflow note (Slice 3 fix)

`deno desktop --hmr` (Deno Desktop's Astro auto-detection) synthesises an entry
that imports `dist/server/entry.mjs`. That file only exists after an Astro build,
so `deno task dev` now chains `npm run build &&` before the `deno desktop --hmr`
command. A pre-build is always required; without it Deno Desktop emits a
TS2307 type-check error at startup and refuses to launch.

### Permissions required

`--allow-read --allow-write --allow-env --allow-net --allow-sys`

The `--allow-sys` flag is needed for `@astrojs/node`'s `os.networkInterfaces()`
logging call.

## File-writing gotcha (MINGW64 / Git Bash on Windows)

When running under Git Bash (MINGW64), `/c/Users/...` paths resolve to `C:\Users\...`
for bash commands, but Python's `os.path.realpath` treats them literally as
`C:\c\Users\...`. Use one of:
- Bash `cat >` / heredoc for small files
- Windows-native paths (`C:/Users/...`) in pi's `write` tool

## Engine layout

```
engine/
  types.ts               # RawWorkflow/RawTask (snake_case) + Workflow/Task (camelCase)
                         # Includes: RawColumnOwner, RawExitCriterion, RawCriterionCheck
                         #           ColumnOwner, ExitCriterion, CriterionCheck
  workflow.ts            # loadWorkflow(), loadRawWorkflow(), validateWorkflow(), columnIds()
                         # saveWorkflow(), updateColumnConfig(), ColumnConfigUpdate
  tasks.ts               # listTasks(), validateTask(), updateTaskStatus()
                         # updateCriteriaChecks()
  runtime-adapter.ts     # RuntimeAdapter interface, CriterionToCheck
  fake-runtime-adapter.ts # FakeRuntimeAdapter (Slice A seam; no real AI)
  workflow_test.ts       # 13 deno tests
  tasks_test.ts          # 10 deno tests
```

Engine is **Deno-only** (not imported by Vite client bundle; imported by API routes
which bundle into the SSR server chunk where Deno APIs are available at runtime).

### Engine conventions

- `BASE_DIR = process.cwd()` in API routes (works in both Node.js and Deno)
- YAML files use snake_case; frontend types use camelCase; conversion in engine

## Slice A schema additions (column ownership + exit-criteria gate, 2026-07)

### workflow.yaml column schema (extended, backward-compatible)

```yaml
columns:
  - id: in-progress
    name: In Progress
    wip_limit: 3
    owner:                       # optional; defaults to { kind: human }
      kind: agent                # "human" | "agent"
      role: code-writer          # only when kind=agent
      instances: 2               # only when kind=agent; default 1
    exit_criteria:               # optional; default []
      - id: ec-1
        description: All unit tests pass
        kind: machine            # "machine" | "human"
      - id: ec-2
        description: Human sign-off
        kind: human
    links_to: null               # reserved for board layering; always null for now
```

`owner` and `exit_criteria` are optional — existing workflows load fine (default: human owner, no criteria).

### task.yaml schema (extended, backward-compatible)

```yaml
criteria_checks:                 # optional; default []
  - column_id: in-progress
    criterion_id: ec-1
    checked: true
    checked_at: "2026-07-07T00:00:00Z"
  - column_id: in-progress
    criterion_id: ec-2
    checked: false
```

Per-card per-column check state. Survives reload. Updated by `updateCriteriaChecks()`.

### RuntimeAdapter seam

`engine/runtime-adapter.ts` defines the minimal interface:

```ts
interface RuntimeAdapter {
  readonly name: string;
  validateMachineCriteria(taskId, columnId, criteria: CriterionToCheck[]): Promise<CriterionToCheck[]>;
}
```

`engine/fake-runtime-adapter.ts` implements it: marks all `machine` criteria checked,
leaves `human` criteria unchanged.

Real adapters (pi, Copilot CLI) are Slice B — only the fake is built here.

### Gated movement mechanics

- **Human drag**: if source column has `exit_criteria`, an `ExitCriteriaGate` dialog
  appears. Human can tick criteria or "Confirm All" to override. Check state persists.
  NOT hard-blocked — human override is always available.
- **Agent advance** (`POST /api/fake-agent-advance { columnId }`): fake adapter
  validates machine criteria (marks them checked), then checks if ALL criteria
  (machine + human) are satisfied. If yes → advances card to next column in order.
  If no → hard-blocked; blocked taskIds + unsatisfied criteria returned in response.

### API routes (all in `src/pages/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/workflow` | GET | Load full workflow (with owner, exitCriteria) |
| `/api/tasks` | GET | Load all tasks (with criteriaChecks) |
| `/api/update-task` | POST | Update task status |
| `/api/update-column` | POST | Update column owner/wipLimit/exitCriteria → workflow.yaml |
| `/api/update-criteria-checks` | POST | Persist check state → task YAML |
| `/api/fake-agent-advance` | POST | Run fake agent on all cards in an agent-owned column |

### Frontend components added

- `src/components/ui/checkbox.tsx` — `Checkbox` using `@base-ui/react/checkbox`
- `src/components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`, etc. using `@base-ui/react/dialog`
- `src/components/kanban/exit-criteria-gate.tsx` — gate dialog shown on human drag
- `src/components/kanban/column-config.tsx` — side sheet to configure owner/WIP/criteria
- `src/components/kanban/column.tsx` — extended: config gear button, agent badge, Run Agent button
- `src/components/kanban/card.tsx` — extended: criteria satisfaction badge (count + green/amber)
- `src/components/kanban/board.tsx` — extended: pendingMove state, wires ExitCriteriaGate
- `src/components/task/task-detail.tsx` — extended: shows exit criteria checkboxes for current column

## Frontend

- `src/pages/index.astro` — shell page; mounts `<App client:only="react" />`
- `src/pages/api/` — server-side API routes
- `src/lib/api.ts` — fetch-based bridge; exports `updateColumnConfig`, `updateCriteriaChecks`, `fakeAgentAdvance`
- `src/App.tsx` — root React island; wires all handlers down to Board + TaskDetail
- `src/components/*` — React components
- `src/lib/types.ts` — TypeScript interfaces (mirrors engine/types.ts camelCase types)

## Durable UI principle

**Reuse existing components; never hand-roll a bespoke component per feature.**
`@base-ui/react` is the primitive layer (Dialog, Checkbox, Sheet, etc.).
To add more: `npx shadcn@latest add FallingReign/cascade-ui/<component>`.

## Slice 2 additions (Drag-and-drop / board interactions, 2026-07)

- **Drag-and-drop**: `@dnd-kit/core` (+ `@dnd-kit/utilities`). Cards are `useDraggable`;
  columns are `useDroppable`. `DndContext` lives in `Board`.
- **WIP enforcement**: done client-side in `onDragEnd`; column turns red when `atLimit`.
- `Board` accepts `onMove: (taskId, newStatus) => Promise<void>`.

## Slice 3 additions (Board polish, 2026-07)

- **Click vs drag**: `PointerSensor` with `activationConstraint: { distance: 8 }`.
- **Actor badge**: each `Card` shows actor as a pill badge.

## Slice A additions (Column ownership + exit-criteria gate, 2026-07)

See "Slice A schema additions" section above.

## What's deferred

- **Board layering** (parent↔child boards / `links_to` column field): `links_to` is in the
  schema (always `null`) but no behavior is built.
- **Real AI adapter**: Slice B. Only `FakeRuntimeAdapter` exists.
- **Agent advance notifications / toast UI**: Slice B. Currently logged to console.
