import type { TaskPriority } from "../types";

/** Tailwind class sets for priority badge colours */
export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  high: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

/** Human-readable priority labels */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Column definitions for the Kanban board (excludes 'archived') */
export const KANBAN_COLUMNS = [
  { status: "todo" as const, label: "Todo", dot: "bg-slate-500" },
  { status: "in_progress" as const, label: "In Progress", dot: "bg-violet-500" },
  { status: "done" as const, label: "Done", dot: "bg-emerald-500" },
];

/** Status transition order for Prev/Next buttons */
export const STATUS_ORDER = ["todo", "in_progress", "done"] as const;
