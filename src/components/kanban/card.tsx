import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import type { Column, Task } from "@/lib/types";

interface CardProps {
  task: Task;
  column: Column;
  onSelect: (task: Task) => void;
}

export function Card({ task, column, onSelect }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // Compute criteria satisfaction for this column
  const exitCriteria = column.exitCriteria;
  const checks = task.criteriaChecks.filter((c) => c.columnId === column.id);
  const satisfied = exitCriteria.length > 0 &&
    exitCriteria.every((ec) => checks.find((c) => c.criterionId === ec.id)?.checked);
  const partial = !satisfied && exitCriteria.length > 0 &&
    checks.some((c) => c.checked);

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(task)}
      className={[
        "w-full rounded-md border bg-card p-2 text-left text-card-foreground shadow-sm cursor-grab active:cursor-grabbing transition-opacity",
        isDragging ? "opacity-50" : "",
      ].join(" ")}
    >
      <p className="font-medium text-sm leading-snug">{task.title}</p>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {task.actor && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <span aria-hidden="true">👤</span>
            {task.actor}
          </span>
        )}
        {exitCriteria.length > 0 && (
          <span className={[
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
            satisfied
              ? "bg-green-100 text-green-700"
              : partial
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground",
          ].join(" ")}>
            {satisfied
              ? <CheckCircle2Icon className="size-3" />
              : <CircleIcon className="size-3" />}
            {checks.filter((c) => c.checked).length}/{exitCriteria.length}
          </span>
        )}
      </div>
    </button>
  );
}
