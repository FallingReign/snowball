import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType, Task } from "@/lib/types";
import { Card } from "./card";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export function Column({ column, tasks, onSelectTask }: ColumnProps) {
  const atLimit = column.wipLimit !== null && tasks.length >= column.wipLimit;

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
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
        <h2 className={["text-sm font-semibold", atLimit ? "text-destructive" : ""].join(" ")}>
          {column.name}
        </h2>
        {column.wipLimit !== null && (
          <span className={atLimit ? "text-xs text-destructive font-medium" : "text-xs text-muted-foreground"}>
            {tasks.length}/{column.wipLimit} WIP
          </span>
        )}
      </header>
      <div className="flex flex-col gap-2 flex-1">
        {tasks.map((task) => (
          <Card key={task.id} task={task} onSelect={onSelectTask} />
        ))}
      </div>
    </section>
  );
}
