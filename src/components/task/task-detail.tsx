import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Column, Task } from "@/lib/types";

interface TaskDetailProps {
  task: Task | null;
  columns: Column[];
  onClose: () => void;
  onMove: (taskId: string, newStatus: string) => Promise<void>;
}

export function TaskDetail({ task, columns, onClose, onMove }: TaskDetailProps) {
  const [moving, setMoving] = useState(false);

  if (!task) return null;

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!task || e.target.value === task.status) return;
    setMoving(true);
    try {
      await onMove(task.id, e.target.value);
    } finally {
      setMoving(false);
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l">
      <header className="flex items-start justify-between gap-2 p-4">
        <h2 className="text-base font-semibold leading-snug">{task.title}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          Close
        </Button>
      </header>

      <Separator />

      <div className="flex flex-col gap-4 p-4">
        {/* Status mover */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
          <select
            value={task.status}
            onChange={handleStatusChange}
            disabled={moving}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
          {moving && <span className="text-xs text-muted-foreground">Moving…</span>}
        </div>

        {/* Actor */}
        {task.actor && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actor</span>
            <span className="text-sm">{task.actor}</span>
          </div>
        )}

        {/* Acceptance criteria */}
        {task.acceptanceCriteria.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Acceptance Criteria</span>
            <ul className="flex flex-col gap-1 text-sm">
              {task.acceptanceCriteria.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Exit criteria */}
        {task.exitCriteria.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exit Criteria</span>
            <ul className="flex flex-col gap-1 text-sm">
              {task.exitCriteria.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Event log */}
        {task.eventLog.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Log</span>
            <ul className="flex flex-col gap-2">
              {task.eventLog.map((e, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <time className="text-xs text-muted-foreground">{e.timestamp}</time>
                  <span className="text-sm">{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

