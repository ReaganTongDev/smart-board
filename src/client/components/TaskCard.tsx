import {
  Archive,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Task, TaskStatus } from "../types";
import { PRIORITY_STYLES, STATUS_ORDER } from "../utils/constants";
import {
  DUE_DATE_STYLES,
  formatDueDate,
  getDueDateStatus,
} from "../utils/date";
import { getChecklistSummary, MarkdownView } from "./MarkdownView";

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onUpdateDescription?: (newDescription: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function TaskCard({
  task,
  isDragging,
  onEdit,
  onDelete,
  onStatusChange,
  onUpdateDescription,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const currentIdx = STATUS_ORDER.indexOf(
    task.status as (typeof STATUS_ORDER)[number]
  );
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < STATUS_ORDER.length - 1;

  const movePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canGoPrev) onStatusChange(STATUS_ORDER[currentIdx - 1]);
  };

  const moveNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canGoNext) onStatusChange(STATUS_ORDER[currentIdx + 1]);
  };

  const archive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange("archived");
  };

  const dueDateStatus = getDueDateStatus(
    task.due_date,
    task.status === "done" || task.status === "archived"
  );
  const checklist = getChecklistSummary(task.description);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={`group relative bg-slate-800 border border-slate-700/60 rounded-xl p-3.5 select-none transition-all
        hover:border-slate-600 hover:bg-slate-800/95
        cursor-pointer
        ${
          isDragging
            ? "opacity-40 scale-[0.97] shadow-none cursor-grabbing"
            : "shadow-sm shadow-black/20"
        }`}
    >
      {/* ── Top row: priority badge + due date + checklist ─────── */}
      <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <GripVertical
            className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          />
          <span
            className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
              PRIORITY_STYLES[task.priority]
            }`}
          >
            {task.priority}
          </span>

          {/* Due date badge */}
          {task.due_date && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                DUE_DATE_STYLES[dueDateStatus]
              }`}
              title={`Due: ${task.due_date}`}
            >
              {dueDateStatus === "overdue" ? (
                <Clock className="w-3 h-3 text-rose-400 shrink-0" />
              ) : (
                <Calendar className="w-3 h-3 shrink-0" />
              )}
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>

        {/* Checklist progress pill */}
        {checklist && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-400 border border-slate-750">
            <CheckSquare className="w-2.5 h-2.5 text-violet-400" />
            {checklist.completed}/{checklist.total}
          </span>
        )}
      </div>

      {/* ── Title ─────────────────────────────────────────────── */}
      <h3
        className={`font-medium text-sm leading-snug mb-1.5 ${
          task.status === "done" ? "line-through text-slate-400" : "text-slate-100"
        }`}
      >
        {task.title}
      </h3>

      {/* ── Markdown description with interactive checklists ──── */}
      {task.description && (
        <div
          className="mb-2.5 text-xs text-slate-400"
          onClick={(e) => e.stopPropagation()}
        >
          <MarkdownView
            content={task.description}
            compact
            onToggleChecklist={onUpdateDescription}
          />
        </div>
      )}

      {/* ── Tags ──────────────────────────────────────────────── */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/80 text-slate-300 border border-slate-600/40"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Action row ────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between pt-2 border-t border-slate-700/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status navigation — prominent for mobile touch */}
        <div className="flex items-center gap-1">
          <button
            onClick={movePrev}
            disabled={!canGoPrev}
            title={
              canGoPrev
                ? `Move to ${STATUS_ORDER[currentIdx - 1].replace("_", " ")}`
                : "Already first"
            }
            className={`flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 ${
              canGoPrev
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100"
                : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <button
            onClick={moveNext}
            disabled={!canGoNext}
            title={
              canGoNext
                ? `Move to ${STATUS_ORDER[currentIdx + 1].replace("_", " ")}`
                : "Already last"
            }
            className={`flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 ${
              canGoNext
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100"
                : "bg-slate-800/50 text-slate-600 cursor-not-allowed"
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit task"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={archive}
            title="Archive task"
            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete task"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
