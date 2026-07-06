import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/lib/types";

interface CardProps {
  task: Task;
  onSelect: (task: Task) => void;
}

export function Card({ task, onSelect }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

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
      {task.actor && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true">👤</span>
          {task.actor}
        </span>
      )}
    </button>
  );
}
