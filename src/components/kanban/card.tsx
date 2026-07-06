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
      <p className="font-medium">{task.title}</p>
      {task.actor && (
        <span className="text-xs text-muted-foreground">{task.actor}</span>
      )}
    </button>
  );
}
