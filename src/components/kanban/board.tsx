import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Column as ColumnType, Task, Workflow } from "@/lib/types";
import { Column } from "./column";

interface BoardProps {
  workflow: Workflow;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onMove: (taskId: string, newStatus: string) => Promise<void>;
}

export function Board({ workflow, tasks, onSelectTask, onMove }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small movement before activating drag so that plain
      // clicks are never swallowed by the drag interaction.
      activationConstraint: { distance: 8 },
    }),
  );

  const tasksByColumn = (col: ColumnType): Task[] =>
    tasks.filter((t) => t.status === col.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // WIP-limit enforcement: count tasks currently in target column.
    const targetCol = workflow.columns.find((c) => c.id === newStatus);
    if (!targetCol) return;

    if (targetCol.wipLimit !== null) {
      const currentCount = tasksByColumn(targetCol).length;
      if (currentCount >= targetCol.wipLimit) {
        // Column is at capacity — silently block the drop.
        return;
      }
    }

    onMove(taskId, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
    </DndContext>
  );
}
