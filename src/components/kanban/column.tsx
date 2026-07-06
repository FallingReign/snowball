import type { Column as ColumnType, Task } from "@/lib/types";
import { Card } from "./card";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export function Column({ column, tasks, onSelectTask }: ColumnProps) {
  const atLimit = column.wipLimit !== null && tasks.length >= column.wipLimit;

  return (
    <section className="flex min-w-56 flex-1 basis-56 flex-col rounded-lg border bg-muted/40 p-3">
      <header className="mb-2">
        <h2 className="text-sm font-semibold">
          {column.name}
        </h2>
        {column.wipLimit !== null && (
          <span className={atLimit ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {tasks.length}/{column.wipLimit} WIP
          </span>
        )}
      </header>
      {tasks.map((task) => (
        <Card key={task.id} task={task} onSelect={onSelectTask} />
      ))}
    </section>
  );
}
