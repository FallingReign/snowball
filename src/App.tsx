import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/ui/app-shell";
import { Board } from "./components/kanban/board";
import { TaskDetail } from "./components/task/task-detail";
import {
  loadWorkflow,
  listTasks,
  updateTaskStatus,
  updateColumnConfig,
  updateCriteriaChecks,
  fakeAgentAdvance,
} from "./lib/api";
import type { Task, Workflow, CriterionCheck } from "./lib/types";
import type { ColumnConfigPayload } from "./lib/api";

function App() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [wf, ts] = await Promise.all([loadWorkflow(), listTasks()]);
    setWorkflow(wf);
    setTasks(ts);
    return { wf, ts };
  }

  useEffect(() => {
    reload().catch((e) => setError(String(e)));
  }, []);

  async function handleMove(taskId: string, newStatus: string) {
    try {
      await updateTaskStatus(taskId, newStatus);
      const { ts } = await reload();
      setSelectedTask(ts.find((t) => t.id === taskId) ?? null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleUpdateColumn(columnId: string, update: ColumnConfigPayload) {
    try {
      await updateColumnConfig(columnId, update);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleUpdateCriteriaChecks(
    taskId: string,
    columnId: string,
    checks: CriterionCheck[],
  ) {
    try {
      await updateCriteriaChecks(taskId, columnId, checks);
      const { ts } = await reload();
      // Keep selectedTask in sync
      if (selectedTask?.id === taskId) {
        setSelectedTask(ts.find((t) => t.id === taskId) ?? null);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleFakeAgentAdvance(columnId: string) {
    try {
      const results = await fakeAgentAdvance(columnId);
      await reload();
      // Report blocked cards in a non-intrusive way (console; UI toast would be Slice B)
      const blocked = results.filter((r) => !r.advanced);
      if (blocked.length > 0) {
        console.info(
          "[fake agent] blocked cards:",
          blocked.map((r) => `${r.taskId}: unsatisfied=[${r.unsatisfiedCriteria.join(",")}]`),
        );
      }
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 p-4">
        <p className="text-destructive">Error: {error}</p>
        <button
          className="text-sm underline text-muted-foreground"
          onClick={() => { setError(null); reload().catch((e) => setError(String(e))); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!workflow) {
    return <p className="p-4 text-muted-foreground">Loading...</p>;
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
            onMove={handleMove}
            onUpdateColumn={handleUpdateColumn}
            onUpdateCriteriaChecks={handleUpdateCriteriaChecks}
            onFakeAgentAdvance={handleFakeAgentAdvance}
          />
          <TaskDetail
            task={selectedTask}
            columns={workflow.columns}
            onMove={handleMove}
            onClose={() => setSelectedTask(null)}
            onUpdateCriteriaChecks={handleUpdateCriteriaChecks}
          />
        </div>
      </AppShell>
    </TooltipProvider>
  );
}

export default App;
