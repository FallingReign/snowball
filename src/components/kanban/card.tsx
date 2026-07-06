import type { Task } from "@/lib/types";

interface CardProps {
  task: Task;
  onSelect: (task: Task) => void;
}

export function Card({ task, onSelect }: CardProps) {
  return (
    <button
      type="button"
      className="mb-2 w-full rounded-md border bg-card p-2 text-left text-card-foreground shadow-sm"
      onClick={() => onSelect(task)}
    >
      <p className="font-medium">{task.title}</p>
      {task.actor && (
        <span className="text-xs text-muted-foreground">{task.actor}</span>
      )}
    </button>
  );
}
