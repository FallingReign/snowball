import { useState } from "react";
import { BotIcon, UserIcon, CheckIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Column, Task, CriterionCheck } from "@/lib/types";

interface ExitCriteriaGateProps {
  open: boolean;
  sourceColumn: Column;
  task: Task;
  onConfirm: (checks: CriterionCheck[]) => Promise<void>;
  onCancel: () => void;
}

/**
 * ExitCriteriaGate — shown when a human drags a card out of a column with exit criteria.
 *
 * Human is NOT hard-blocked: they can tick items or "Confirm All" to proceed.
 * Check state is persisted alongside the move so it survives reload.
 */
export function ExitCriteriaGate({ open, sourceColumn, task, onConfirm, onCancel }: ExitCriteriaGateProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const ec of sourceColumn.exitCriteria) {
      const existing = task.criteriaChecks.find(
        (c) => c.columnId === sourceColumn.id && c.criterionId === ec.id,
      );
      initial[ec.id] = existing?.checked ?? false;
    }
    return initial;
  });
  const [confirming, setConfirming] = useState(false);

  const criteria = sourceColumn.exitCriteria;
  const allChecked = criteria.length > 0 && criteria.every((ec) => checks[ec.id]);

  function toggleCheck(id: string, value: boolean) {
    setChecks((prev) => ({ ...prev, [id]: value }));
  }

  async function handleConfirm(checkAll: boolean) {
    setConfirming(true);
    try {
      const now = new Date().toISOString();
      const finalChecks: CriterionCheck[] = criteria.map((ec) => ({
        columnId: sourceColumn.id,
        criterionId: ec.id,
        checked: checkAll ? true : (checks[ec.id] ?? false),
        checkedAt: (checkAll || checks[ec.id]) ? now : undefined,
      }));
      await onConfirm(finalChecks);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogTitle>Move: {task.title}</DialogTitle>
        <DialogDescription>
          Exit criteria for <strong>{sourceColumn.name}</strong> — tick what is satisfied,
          or confirm all to proceed.
        </DialogDescription>
        <Separator />
        {criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exit criteria defined.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {criteria.map((ec) => (
              <li key={ec.id} className="flex items-start gap-3">
                <Checkbox
                  id={"gate-" + ec.id}
                  checked={checks[ec.id] ?? false}
                  onCheckedChange={(v) => toggleCheck(ec.id, Boolean(v))}
                  className="mt-0.5"
                />
                <label htmlFor={"gate-" + ec.id} className="flex-1 cursor-pointer text-sm leading-snug">
                  <span className="block font-medium">{ec.description}</span>
                  <span className={[
                    "inline-flex items-center gap-1 mt-0.5 text-xs",
                    ec.kind === "machine" ? "text-blue-500" : "text-amber-600",
                  ].join(" ")}>
                    {ec.kind === "machine"
                      ? <><BotIcon className="size-3" /><span>machine</span></>
                      : <><UserIcon className="size-3" /><span>human</span></>}
                  </span>
                </label>
                {checks[ec.id] && <CheckIcon className="size-4 shrink-0 mt-0.5 text-green-500" />}
              </li>
            ))}
          </ul>
        )}
        <Separator />
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>Cancel</Button>
          <div className="flex gap-2">
            {!allChecked && criteria.length > 0 && (
              <Button variant="outline" onClick={() => handleConfirm(true)} disabled={confirming}>
                Confirm All
              </Button>
            )}
            <Button onClick={() => handleConfirm(false)} disabled={confirming}>
              {allChecked ? "Move" : "Move Anyway"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
