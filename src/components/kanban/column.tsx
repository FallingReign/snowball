import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { Settings2Icon, BotIcon, PlayIcon } from "lucide-react";
import type { Column as ColumnType, Task } from "@/lib/types";
import type { ColumnConfigPayload } from "@/lib/api";
import { Card } from "./card";
import { ColumnConfig } from "./column-config";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onUpdateColumn: (columnId: string, update: ColumnConfigPayload) => Promise<void>;
  onFakeAgentAdvance: (columnId: string) => Promise<void>;
}

export function Column({ column, tasks, onSelectTask, onUpdateColumn, onFakeAgentAdvance }: ColumnProps) {
  const atLimit = column.wipLimit !== null && tasks.length >= column.wipLimit;
  const [configOpen, setConfigOpen] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  async function handleAgentRun() {
    setAgentRunning(true);
    try {
      await onFakeAgentAdvance(column.id);
    } finally {
      setAgentRunning(false);
    }
  }

  return (
    <>
      <section
        ref={setNodeRef}
        className={[
          "flex min-w-56 flex-1 basis-56 flex-col rounded-lg border p-3 transition-colors",
          atLimit
            ? "border-destructive bg-destructive/10"
            : isOver
              ? "border-primary bg-primary/5"
              : "bg-muted/40",
        ].join(" ")}
      >
        <header className="mb-2">
          <div className="flex items-center justify-between gap-1">
            <h2 className={["text-sm font-semibold leading-none", atLimit ? "text-destructive" : ""].join(" ")}>
              {column.name}
            </h2>
            <div className="flex items-center gap-0.5">
              {/* Owner badge */}
              {column.owner.kind === "agent" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                  <BotIcon className="size-3" />
                  {column.owner.role || "agent"}
                </span>
              )}
              {/* Config gear */}
              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Configure ${column.name}`}
              >
                <Settings2Icon className="size-3.5" />
              </button>
            </div>
          </div>
          {column.wipLimit !== null && (
            <span className={atLimit ? "text-xs text-destructive font-medium" : "text-xs text-muted-foreground"}>
              {tasks.length}/{column.wipLimit} WIP
            </span>
          )}
          {/* Exit criteria summary */}
          {column.exitCriteria.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {column.exitCriteria.length} exit {column.exitCriteria.length === 1 ? "criterion" : "criteria"}
            </p>
          )}
        </header>

        <div className="flex flex-col gap-2 flex-1">
          {tasks.map((task) => (
            <Card key={task.id} task={task} column={column} onSelect={onSelectTask} />
          ))}
        </div>

        {/* Run agent button — only for agent-owned columns */}
        {column.owner.kind === "agent" && (
          <button
            type="button"
            onClick={handleAgentRun}
            disabled={agentRunning || tasks.length === 0}
            className={[
              "mt-3 flex items-center justify-center gap-1.5 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition-colors",
              agentRunning || tasks.length === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-blue-50",
            ].join(" ")}
          >
            <PlayIcon className="size-3" />
            {agentRunning ? "Running..." : "Run Agent"}
          </button>
        )}
      </section>

      <ColumnConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        column={column}
        onSave={onUpdateColumn}
      />
    </>
  );
}
