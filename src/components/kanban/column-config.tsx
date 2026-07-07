import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Column, ExitCriterion } from "@/lib/types";
import type { ColumnConfigPayload } from "@/lib/api";

interface ColumnConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: Column;
  onSave: (columnId: string, update: ColumnConfigPayload) => Promise<void>;
}

let nextEcSeq = Date.now();
function newEcId() {
  return `ec-${(nextEcSeq++).toString(36)}`;
}

/**
 * ColumnConfig — side sheet for editing a column's owner, WIP limit, exit
 * criteria, and (when agent-owned) the runtime adapter configuration.
 */
export function ColumnConfig({ open, onOpenChange, column, onSave }: ColumnConfigProps) {
  const [ownerKind, setOwnerKind] = useState<"human" | "agent">(column.owner.kind);
  const [role, setRole] = useState(column.owner.role ?? "");
  const [instances, setInstances] = useState(String(column.owner.instances ?? 1));

  // Runtime config (agent-owned columns only)
  const [runtime, setRuntime] = useState<"fake" | "copilot-cli">(
    column.owner.runtime ?? "fake",
  );
  const [cliPath, setCliPath] = useState(column.owner.runtimeConfig?.cliPath ?? "");
  const [instructions, setInstructions] = useState(
    column.owner.runtimeConfig?.instructions ?? "",
  );

  const [wipLimit, setWipLimit] = useState(
    column.wipLimit !== null ? String(column.wipLimit) : "",
  );
  const [criteria, setCriteria] = useState<ExitCriterion[]>(column.exitCriteria);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCriterion() {
    setCriteria((prev) => [...prev, { id: newEcId(), description: "", kind: "human" }]);
  }

  function removeCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCriterion(id: string, field: "description" | "kind", value: string) {
    setCriteria((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const parsedWip = wipLimit.trim() === "" ? null : parseInt(wipLimit, 10);

      let ownerPayload: ColumnConfigPayload["owner"];
      if (ownerKind === "human") {
        ownerPayload = { kind: "human" };
      } else {
        ownerPayload = {
          kind: "agent",
          role: role.trim(),
          instances: Math.max(1, parseInt(instances, 10) || 1),
          runtime,
          runtime_config: runtime === "copilot-cli"
            ? {
                cli_path: cliPath.trim() || undefined,
                instructions: instructions.trim() || undefined,
              }
            : undefined,
        };
      }

      const payload: ColumnConfigPayload = {
        wip_limit: parsedWip,
        owner: ownerPayload,
        exit_criteria: criteria
          .filter((c) => c.description.trim() !== "")
          .map((c) => ({ id: c.id, description: c.description.trim(), kind: c.kind })),
      };
      await onSave(column.id, payload);
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 overflow-y-auto flex flex-col gap-5 pt-10">
        <SheetHeader>
          <SheetTitle>Configure: {column.name}</SheetTitle>
          <SheetDescription>Set owner, runtime, WIP limit, and exit criteria.</SheetDescription>
        </SheetHeader>

        {/* ── Owner ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</span>
          <div className="flex gap-2">
            {(["human", "agent"] as const).map((k) => (
              <Button key={k} size="sm" variant={ownerKind === k ? "default" : "outline"}
                onClick={() => setOwnerKind(k)} type="button">
                {k === "human" ? "Human" : "Agent"}
              </Button>
            ))}
          </div>

          {ownerKind === "agent" && (
            <div className="flex flex-col gap-3">
              {/* Role + instances */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Role</label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. code-writer" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Max parallel instances</label>
                  <Input type="number" min={1} value={instances}
                    onChange={(e) => setInstances(e.target.value)} />
                </div>
              </div>

              <Separator />

              {/* Runtime selection */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Runtime</span>
                <div className="flex gap-2">
                  {([
                    { value: "fake", label: "Fake (dev/test)" },
                    { value: "copilot-cli", label: "Copilot CLI" },
                  ] as const).map(({ value, label }) => (
                    <Button key={value} size="sm"
                      variant={runtime === value ? "default" : "outline"}
                      onClick={() => setRuntime(value)} type="button">
                      {label}
                    </Button>
                  ))}
                </div>

                {runtime === "fake" && (
                  <p className="text-xs text-muted-foreground">
                    Fake adapter: machine criteria are always marked satisfied. Safe for dev and testing.
                  </p>
                )}

                {runtime === "copilot-cli" && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Requires the standalone <code className="font-mono bg-muted px-1 rounded">copilot</code> CLI
                      (GitHub Copilot CLI). Must already be authenticated.
                    </p>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">
                        Copilot CLI path <span className="opacity-60">(optional, default: copilot)</span>
                      </label>
                      <Input value={cliPath} onChange={(e) => setCliPath(e.target.value)}
                        placeholder="copilot" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">
                        Instructions <span className="opacity-60">(optional, injected into every prompt)</span>
                      </label>
                      <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="e.g. This is a TypeScript project using Deno. Tests run via `deno task test`."
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <Separator />

        {/* ── WIP Limit ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WIP Limit</span>
          <Input type="number" min={1} value={wipLimit}
            onChange={(e) => setWipLimit(e.target.value)} placeholder="No limit" />
        </section>

        <Separator />

        {/* ── Exit Criteria ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exit Criteria</span>
          {criteria.length === 0 && (
            <p className="text-xs text-muted-foreground">No criteria yet — cards leave freely.</p>
          )}
          {criteria.map((ec, i) => (
            <div key={ec.id} className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                <Input value={ec.description}
                  onChange={(e) => updateCriterion(ec.id, "description", e.target.value)}
                  placeholder="What must be true before the card leaves?"
                  className="flex-1 h-7 text-xs" />
                <button type="button" onClick={() => removeCriterion(ec.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove criterion">
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
              <div className="flex gap-1.5 pl-6">
                {(["human", "machine"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => updateCriterion(ec.id, "kind", k)}
                    className={["rounded px-2 py-0.5 text-xs border transition-colors",
                      ec.kind === k
                        ? k === "human" ? "bg-amber-100 border-amber-400 text-amber-700" : "bg-blue-100 border-blue-400 text-blue-700"
                        : "border-border text-muted-foreground"].join(" ")}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addCriterion} className="gap-1.5">
            <PlusIcon className="size-3.5" /> Add criterion
          </Button>
        </section>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 mt-auto pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
