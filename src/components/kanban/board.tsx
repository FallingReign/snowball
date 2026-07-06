import type { Column as ColumnType, Task, Workflow } from "@/lib/types";
import { Column } from "./column";

interface BoardProps {
  workflow: Workflow;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export function Board({ workflow, tasks, onSelectTask }: BoardProps) {
  const tasksByColumn = (col: ColumnType): Task[] =>
    tasks.filter((t) => t.status === col.id);

  return (
    <main className="flex h-full gap-4 overflow-x-auto p-4">
      {workflow.columns.map((col) => (
        <Column
          key={col.id}
          column={col}
          tasks={tasksByColumn(col)}
          onSelectTask={onSelectTask}
        />
      ))}
    </main>
  );
}
