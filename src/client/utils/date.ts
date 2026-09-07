import type { Task } from "../types";

export type DueDateStatus =
  | "overdue"
  | "today"
  | "tomorrow"
  | "soon"
  | "future"
  | "none";

/** Parse a date string (YYYY-MM-DD or ISO) into local midnight Date */
export function parseLocalDate(dateStr: string): Date {
  // If YYYY-MM-DD format, split to prevent UTC timezone offset shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Get difference in calendar days between dueDate and today */
export function getDaysDiffFromToday(dueDateStr: string): number {
  const target = parseLocalDate(dueDateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const msDiff = target.getTime() - today.getTime();
  return Math.round(msDiff / (1000 * 60 * 60 * 24));
}

/** Determine urgency status of a due date */
export function getDueDateStatus(
  dueDate: string | null | undefined,
  isCompleted = false
): DueDateStatus {
  if (!dueDate) return "none";
  if (isCompleted) return "future";

  const diff = getDaysDiffFromToday(dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 3) return "soon";
  return "future";
}

/** Human-readable due date label */
export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return "";
  const diff = getDaysDiffFromToday(dueDate);
  const date = parseLocalDate(dueDate);

  if (diff < 0) {
    const daysAgo = Math.abs(diff);
    return daysAgo === 1 ? "Overdue (Yesterday)" : `Overdue (${daysAgo}d ago)`;
  }
  if (diff === 0) return "Due Today";
  if (diff === 1) return "Due Tomorrow";
  if (diff <= 6) return `Due ${date.toLocaleDateString(undefined, { weekday: "short" })}`;

  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}

/** Tailwind styles for due date badges */
export const DUE_DATE_STYLES: Record<DueDateStatus, string> = {
  overdue: "text-rose-400 bg-rose-500/10 border-rose-500/25 animate-pulse",
  today: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  tomorrow: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  soon: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  future: "text-slate-400 bg-slate-800/80 border-slate-700/60",
  none: "",
};

// ─── Filter Predicates ─────────────────────────────────────────────

export function isTaskOverdue(task: Task): boolean {
  if (!task.due_date || task.status === "done" || task.status === "archived") {
    return false;
  }
  return getDaysDiffFromToday(task.due_date) < 0;
}

export function isTaskWithinDays(task: Task, days: number): boolean {
  if (!task.due_date || task.status === "archived") return false;
  const diff = getDaysDiffFromToday(task.due_date);
  return diff >= 0 && diff <= days;
}

export function isTaskThisWeek(task: Task): boolean {
  if (!task.due_date || task.status === "archived") return false;
  const diff = getDaysDiffFromToday(task.due_date);
  return diff >= 0 && diff <= 7;
}

export function isTaskThisMonth(task: Task): boolean {
  if (!task.due_date || task.status === "archived") return false;
  const diff = getDaysDiffFromToday(task.due_date);
  return diff >= 0 && diff <= 30;
}

export function isTaskUpcoming(task: Task): boolean {
  if (!task.due_date || task.status === "archived") return false;
  return getDaysDiffFromToday(task.due_date) >= 0;
}
