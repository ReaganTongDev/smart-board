import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Filter,
  Inbox,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "../types";
import { useTasks } from "../hooks/useTasks";
import { KANBAN_COLUMNS } from "../utils/constants";
import {
  getDueDateStatus,
  isTaskOverdue,
  isTaskThisWeek,
  isTaskWithinDays,
} from "../utils/date";
import { TaskCard } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { DeleteModal } from "./DeleteModal";

type DueFilter = "all" | "overdue" | "today" | "week";

export function KanbanBoard() {
  const { tasks, loading, error, createTask, updateTask, deleteTask } =
    useTasks();

  // ─── Modal state ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // ─── Search & Filter state ──────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | "all">(
    "all"
  );
  const [selectedDue, setSelectedDue] = useState<DueFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string | "all">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Drag state ─────────────────────────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  // All active tasks (excluding archived)
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks]
  );

  // Unique tags for active tasks
  const allTags = useMemo(() => {
    const s = new Set<string>();
    activeTasks.forEach((t) => t.tags.forEach((tag) => s.add(tag)));
    return Array.from(s);
  }, [activeTasks]);

  // Filtered tasks based on search & filters
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeTasks.filter((t) => {
      // 1. Search query
      if (q) {
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q) ?? false;
        const matchesTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      // 2. Priority
      if (selectedPriority !== "all" && t.priority !== selectedPriority) {
        return false;
      }

      // 3. Due Date
      if (selectedDue === "overdue" && !isTaskOverdue(t)) return false;
      if (selectedDue === "today" && !isTaskWithinDays(t, 0)) return false;
      if (selectedDue === "week" && !isTaskThisWeek(t)) return false;

      // 4. Tag
      if (selectedTag !== "all" && !t.tags.includes(selectedTag)) {
        return false;
      }

      return true;
    });
  }, [activeTasks, searchQuery, selectedPriority, selectedDue, selectedTag]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedPriority !== "all" ||
    selectedDue !== "all" ||
    selectedTag !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPriority("all");
    setSelectedDue("all");
    setSelectedTag("all");
  };

  // ─── Event handlers ─────────────────────────────────────────────
  const openCreate = (status: TaskStatus) => {
    setDefaultStatus(status);
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDraggedId(taskId), 0);
  };

  const handleDragOver = (e: React.DragEvent, col: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedId) return;
    const task = tasks.find((t) => t.id === draggedId);
    if (task && task.status !== targetStatus) {
      await updateTask(draggedId, { status: targetStatus });
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleSave = async (
    data: Omit<Task, "id" | "user_id" | "created_at" | "updated_at">
  ) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask({
        ...data,
        description: data.description ?? undefined,
        status: data.status ?? defaultStatus,
      });
    }
    setModalOpen(false);
    setEditingTask(null);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteTask(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  // ─── Loading / error states ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-400">
        <p className="font-medium">Failed to load tasks</p>
        <p className="text-sm mt-1 text-rose-400/70">{error}</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Board</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {hasActiveFilters
              ? `${filteredTasks.length} of ${activeTasks.length} tasks`
              : `${activeTasks.length} active task${
                  activeTasks.length !== 1 ? "s" : ""
                }`}
          </p>
        </div>
        <button
          onClick={() => openCreate("todo")}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* ── Search & Filter Bar ───────────────────────────────── */}
      <div className="mb-6 p-3 bg-slate-900/90 border border-slate-700/60 rounded-2xl shadow-sm space-y-3">
        {/* Top row: search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, description, or #tag… (Press /)"
            className="w-full pl-9 pr-9 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Bottom row: filter buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-800 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            {/* Priority filter */}
            <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-750">
              <span className="text-slate-500 px-1 text-[11px]">Priority:</span>
              {(["all", "high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition-all text-[11px] ${
                    selectedPriority === p
                      ? "bg-slate-700 text-slate-100 shadow-sm"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {p === "all" ? "All" : p}
                </button>
              ))}
            </div>

            {/* Due date filter */}
            <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-750">
              <span className="text-slate-500 px-1 text-[11px]">Due:</span>
              {(
                [
                  { id: "all", label: "All" },
                  { id: "overdue", label: "Overdue" },
                  { id: "today", label: "Today" },
                  { id: "week", label: "This Week" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSelectedDue(id)}
                  className={`px-2 py-0.5 rounded font-medium transition-all text-[11px] ${
                    selectedDue === id
                      ? "bg-slate-700 text-slate-100 shadow-sm"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tag filter dropdown */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-750">
                <Tag className="w-3 h-3 text-slate-500 ml-1" />
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="bg-transparent text-slate-300 text-[11px] focus:outline-none pr-1 py-0.5 cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">
                    All Tags
                  </option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag} className="bg-slate-900">
                      #{tag}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-slate-800 transition-all"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* 3-column Kanban grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {KANBAN_COLUMNS.map(({ status, label, dot }) => {
          const colTasks = filteredTasks.filter((t) => t.status === status);
          const isDropTarget = dragOverCol === status;

          return (
            <div
              key={status}
              onDragOver={(e) => handleDragOver(e, status)}
              onDrop={(e) => handleDrop(e, status)}
              onDragLeave={() => setDragOverCol(null)}
              className={`bg-slate-900/60 border rounded-2xl p-4 transition-all ${
                isDropTarget
                  ? "border-violet-500/60 bg-violet-500/5"
                  : "border-slate-700/50"
              }`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <h2 className="font-semibold text-slate-200 text-sm">
                    {label}
                  </h2>
                  <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => openCreate(status)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all"
                  aria-label={`Add task to ${label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Task list */}
              <div className="space-y-2.5 min-h-[64px]">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggedId === task.id}
                    onEdit={() => openEdit(task)}
                    onDelete={() => setDeleteTarget(task)}
                    onStatusChange={(s) => updateTask(task.id, { status: s })}
                    onUpdateDescription={(newDesc) =>
                      updateTask(task.id, { description: newDesc })
                    }
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}

                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-700">
                    <Inbox className="w-6 h-6 mb-1.5" />
                    <p className="text-xs">
                      {hasActiveFilters ? "No matching tasks" : "No tasks"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <TaskModal
        open={modalOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSave={handleSave}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
        }}
      />

      <DeleteModal
        open={!!deleteTarget}
        taskTitle={deleteTarget?.title ?? ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
