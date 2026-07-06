/**
 * main.ts — Deno Desktop entry point for Snowball.
 *
 * Development workflow (two terminals):
 *   Terminal 1: npm run dev          # Vite dev server on :5173
 *   Terminal 2: deno task dev        # Deno Desktop window pointed at Vite
 *
 * Production build:
 *   deno task build                  # vite build + deno desktop compile
 */

import { serveDir } from "jsr:@std/http/file-server";
import { loadWorkflow } from "./engine/workflow.ts";
import { listTasks, updateTaskStatus } from "./engine/tasks.ts";

const DEV_URL = Deno.env.get("SNOWBALL_DEV_URL");
const BASE_DIR = Deno.cwd();

// ---------------------------------------------------------------------------
// Production: serve the Vite-built dist/ as a static site.
// Calling Deno.serve() causes Deno Desktop to auto-open the startup window and
// navigate it to the bound address — no explicit navigate() call needed.
// ---------------------------------------------------------------------------
if (!DEV_URL) {
  Deno.serve(
    { port: 0 }, // port 0 = let OS pick
    (req) =>
      serveDir(req, {
        fsRoot: `${BASE_DIR}/dist`,
        urlRoot: "",
        enableCors: true,
        showDirListing: false,
      }),
  );
}

// ---------------------------------------------------------------------------
// Window — adopt the startup window (first construction).
// Subsequent Deno.BrowserWindow() calls open additional windows.
// ---------------------------------------------------------------------------
const win = new Deno.BrowserWindow({
  title: "Snowball",
  width: 1280,
  height: 800,
});

// In dev mode, navigate the window to the Vite dev server.
if (DEV_URL) {
  win.navigate(DEV_URL);
}

// ---------------------------------------------------------------------------
// Bindings — expose the TypeScript engine to the webview.
// The webview accesses these via the injected `bindings` Proxy:
//   bindings.loadWorkflow()
//   bindings.listTasks()
//   bindings.updateTaskStatus(taskId, newStatus)
// Arguments and return values are JSON-serialised across the boundary.
// ---------------------------------------------------------------------------

win.bind("loadWorkflow", () => loadWorkflow(BASE_DIR));

win.bind("listTasks", () => listTasks(BASE_DIR));

win.bind(
  "updateTaskStatus",
  (taskId: string, newStatus: string) =>
    updateTaskStatus(BASE_DIR, taskId, newStatus),
);
