import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Column as ColumnType, Task, Workflow, CriterionCheck } from "@/lib/types";
import type { ColumnConfigPayload } from "@/lib/api";
import { Column } from "./column";
import { ExitCriteriaGate } from "./exit-criteria-gate";

interface BoardProps {
  workflow: Workflow;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onMove: (taskId: string, newStatus: string) => Promise<void>;
  onUpdateColumn: (columnId: string, update: ColumnConfigPayload) => Promise<void>;
  onUpdateCriteriaChecks: (taskId: string, columnId: string, checks: CriterionCheck[]) => Promise<void>;
  onAgentAdvance: (columnId: string) => Promise<void>;
}

interface PendingMove {
  taskId: string;
  fromColId: string;
  toColId: string;
}

export function Board({
  workflow,
  tasks,
  onSelectTask,
  onMove,
  onUpdateColumn,
  onUpdateCriteriaChecks,
  onAgentAdvance,
}: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const tasksByColumn = (col: ColumnType): Task[] =>
    tasks.filter((t) => t.status === col.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const targetCol = workflow.columns.find((c) => c.id === newStatus);
    if (!targetCol) return;

    // WIP-limit enforcement on target column.
    if (targetCol.wipLimit !== null) {
      const currentCount = tasksByColumn(targetCol).length;
      if (currentCount >= targetCol.wipLimit) return;
    }

    const sourceCol = workflow.columns.find((c) => c.id === task.status);
    if (!sourceCol) return;

    // If the source column has exit criteria, gate the move.
    if (sourceCol.exitCriteria.length > 0) {
      setPendingMove({ taskId, fromColId: sourceCol.id, toColId: newStatus });
      return;
    }

    // No exit criteria — move immediately.
    onMove(taskId, newStatus);
  }

  async function handleGateConfirm(checks: CriterionCheck[]) {
    if (!pendingMove) return;
    const { taskId, fromColId, toColId } = pendingMove;
    // Persist criteria check state, then execute the move.
    await onUpdateCriteriaChecks(taskId, fromColId, checks);
    await onMove(taskId, toColId);
    setPendingMove(null);
  }

  function handleGateCancel() {
    setPendingMove(null);
  }

  const pendingTask = pendingMove
    ? tasks.find((t) => t.id === pendingMove.taskId) ?? null
    : null;
  const pendingSourceCol = pendingMove
    ? workflow.columns.find((c) => c.id === pendingMove.fromColId) ?? null
    : null;

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <main className="flex h-full gap-4 overflow-x-auto p-4">
          {workflow.columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={tasksByColumn(col)}
              onSelectTask={onSelectTask}
              onUpdateColumn={onUpdateColumn}
              onAgentAdvance={onAgentAdvance}
            />
          ))}
        </main>
      </DndContext>

      {pendingTask && pendingSourceCol && (
        <ExitCriteriaGate
          open={true}
          sourceColumn={pendingSourceCol}
          task={pendingTask}
          onConfirm={handleGateConfirm}
          onCancel={handleGateCancel}
        />
      )}
    </>
  );
}
