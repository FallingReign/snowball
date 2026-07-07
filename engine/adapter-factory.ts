import type { RuntimeAdapter } from "./runtime-adapter.ts";
import type { RawColumnOwner } from "./types.ts";
import { FakeRuntimeAdapter } from "./fake-runtime-adapter.ts";
import { CopilotCliAdapter } from "./copilot-cli-adapter.ts";

/**
 * createAdapter — factory that maps a column's owner config to the correct
 * RuntimeAdapter implementation.
 *
 * Defaults to FakeRuntimeAdapter when no runtime is specified (safe for dev/test).
 */
export function createAdapter(owner: RawColumnOwner): RuntimeAdapter {
  const runtime = owner.runtime ?? "fake";

  switch (runtime) {
    case "copilot-cli":
      return new CopilotCliAdapter({
        cliPath: owner.runtime_config?.cli_path,
        instructions: owner.runtime_config?.instructions,
        timeoutMs: owner.runtime_config?.timeout_ms,
      });

    case "fake":
    default:
      return new FakeRuntimeAdapter();
  }
}
