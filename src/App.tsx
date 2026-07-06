import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/ui/app-shell";
import { Board } from "./components/kanban/board";
import { TaskDetail } from "./components/task/task-detail";
import { loadWorkflow, listTasks, updateTaskStatus } from "./lib/tauri";
import type { Task, Workflow } from "./lib/types";

function App() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadWorkflow(), listTasks()])
      .then(([wf, ts]) => {
        setWorkflow(wf);
        setTasks(ts);
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function handleMove(taskId: string, newStatus: string) {
    try {
      await updateTaskStatus(taskId, newStatus);
      const fresh = await listTasks();
      setTasks(fresh);
      setSelectedTask(fresh.find((t) => t.id === taskId) ?? null);
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) {
    return <p className="text-destructive p-4">Error: {error}</p>;
  }

  if (!workflow) {
    return <p className="p-4 text-muted-foreground">Loading…</p>;
  }

  return (
    <TooltipProvider>
      <AppShell
        sidebarHeader={<span className="text-sm font-bold">Snowball</span>}
        sidebar={
          <nav className="px-2 py-1 text-sm text-muted-foreground">
            <p className="font-medium">{workflow.name}</p>
          </nav>
        }
        toolbar={<span className="text-sm font-medium">Kanban Board</span>}
        statusBar={<span>{tasks.length} tasks</span>}
      >
        <div className="flex h-full overflow-hidden">
          <Board
            workflow={workflow}
            tasks={tasks}
            onSelectTask={setSelectedTask}
          />
          <TaskDetail task={selectedTask} columns={workflow.columns} onMove={handleMove} onClose={() => setSelectedTask(null)} />
        </div>
      </AppShell>
    </TooltipProvider>
  );
}

export default App;
