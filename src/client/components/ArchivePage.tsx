import { useState } from "react";
import { Archive, Package, RotateCcw, Trash2 } from "lucide-react";
import type { Task } from "../types";
import { useTasks } from "../hooks/useTasks";
import { PRIORITY_STYLES } from "../utils/constants";
import { DeleteModal } from "./DeleteModal";

export function ArchivePage() {
  const { tasks, loading, updateTask, deleteTask } = useTasks();
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const archivedTasks = tasks.filter((t) => t.status === "archived");

  const handleRestore = (task: Task) =>
    updateTask(task.id, { status: "todo" });

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteTask(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Archive className="w-5 h-5 text-slate-400" />
          <h1 className="text-xl font-bold text-slate-100">Archive</h1>
        </div>
        <p className="text-slate-500 text-sm">
          {archivedTasks.length} archived task
          {archivedTasks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {archivedTasks.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No archived tasks</p>
          <p className="text-slate-600 text-sm mt-1">
            Archive tasks from the board to keep them out of your way
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {archivedTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 flex items-start gap-4 transition-all hover:border-slate-600/50"
            >
              {/* Task info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-1.5 mb-1">
                  <span
                    className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${
                      PRIORITY_STYLES[task.priority]
                    }`}
                  >
                    {task.priority}
                  </span>
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="font-medium text-slate-300 text-sm leading-snug">
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {task.description}
                  </p>
                )}
                <p className="text-[11px] text-slate-600 mt-1">
                  Archived{" "}
                  {new Date(task.updated_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => void handleRestore(task)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-all active:scale-95"
                  title="Restore to Todo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
                <button
                  onClick={() => setDeleteTarget(task)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                  title="Delete permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteModal
        open={!!deleteTarget}
        taskTitle={deleteTarget?.title ?? ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
