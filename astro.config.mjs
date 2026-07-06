import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readFile,
  writeFile,
  stat,
  readdir,
} from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deno polyfill for Astro dev (Node.js) context.
//
// In production the Astro server bundle runs inside Deno Desktop's Deno
// runtime, where globalThis.Deno is the real thing. In dev mode Astro runs
// the SSR modules in Node.js (via Vite), so we shim the subset of Deno APIs
// that the engine uses. The shim is a no-op when the real Deno is present.
// ---------------------------------------------------------------------------
function installDenoPolyfill() {
  if (typeof globalThis.Deno !== "undefined") return;
  globalThis.Deno = {
    readTextFile: (p) => readFile(String(p), "utf-8"),
    writeTextFile: (p, data) => writeFile(String(p), String(data), "utf-8"),
    stat: (p) => stat(String(p)),
    readDir(p) {
      return (async function* () {
        const entries = await readdir(String(p), { withFileTypes: true });
        for (const e of entries) {
          yield {
            name: e.name,
            isFile: e.isFile(),
            isDirectory: e.isDirectory(),
            isSymlink: e.isSymbolicLink(),
          };
        }
      })();
    },
  };
}

// Apply once at config-load time (covers the initial server startup path).
installDenoPolyfill();

export default defineConfig({
  // SSR mode: API routes run server-side inside Deno Desktop's Deno runtime.
  output: "server",
  adapter: node({ mode: "standalone" }),

  integrations: [react()],

  vite: {
    plugins: [
      // Ensure the shim is also installed when Vite's dev server starts up.
      {
        name: "deno-polyfill",
        configureServer() {
          installDenoPolyfill();
        },
      },
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Map the Deno JSR specifier to the ESM browser build of the npm yaml
        // package so Vite can bundle the engine without resolving jsr: URLs.
        "jsr:@std/yaml": path.resolve(
          __dirname,
          "node_modules/yaml/browser/dist/index.js",
        ),
        // Path alias matching tsconfig paths.
        "@": path.resolve(__dirname, "./src"),
      },
    },
  },
});
