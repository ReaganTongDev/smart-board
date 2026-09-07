import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Inbox,
  Pencil,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { Task } from "../types";
import { useTasks } from "../hooks/useTasks";
import { PRIORITY_STYLES } from "../utils/constants";
import {
  DUE_DATE_STYLES,
  formatDueDate,
  getDueDateStatus,
  isTaskOverdue,
  isTaskThisMonth,
  isTaskThisWeek,
  isTaskUpcoming,
  isTaskWithinDays,
  parseLocalDate,
} from "../utils/date";
import { MarkdownView } from "./MarkdownView";
import { TaskModal } from "./TaskModal";

type QuickBucket =
  | "3days"
  | "7days"
  | "week"
  | "month"
  | "upcoming"
  | "overdue"
  | "all";

export function CalendarPage() {
  const { tasks, loading, updateTask } = useTasks();

  // Current calendar view month/year
  const [currentDate, setCurrentDate] = useState(() => new Date());
  // Selected date on calendar (YYYY-MM-DD) or null
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  // Selected bucket in the interactive container
  const [selectedBucket, setSelectedBucket] = useState<QuickBucket>("3days");
  // Selected task to inspect details in the detail panel
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // Task modal for editing
  const [modalTask, setModalTask] = useState<Task | null>(null);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks]
  );

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(
      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
    );
  };
  const nextMonth = () => {
    setCurrentDate(
      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
    );
  };
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setSelectedDateStr(`${yyyy}-${mm}-${dd}`);
  };

  // ─── Generate Calendar Month Grid ───────────────────────────────
  const { daysInGrid, monthLabel } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthLabel = currentDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // 1. Fill previous month tail days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const date = new Date(year, month - 1, d);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateStr = `${date.getFullYear()}-${mm}-${dd}`;
      days.push({
        date,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Fill current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(year, month, d);
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Fill next month head days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateStr = `${date.getFullYear()}-${mm}-${dd}`;
      days.push({
        date,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return { daysInGrid: days, monthLabel };
  }, [currentDate]);

  // Map of dateStr -> tasks
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    activeTasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });
    return map;
  }, [activeTasks]);

  // ─── Filter Bucket Counts ────────────────────────────────────────
  const bucketCounts = useMemo(() => {
    return {
      "3days": activeTasks.filter((t) => isTaskWithinDays(t, 3)).length,
      "7days": activeTasks.filter((t) => isTaskWithinDays(t, 7)).length,
      week: activeTasks.filter(isTaskThisWeek).length,
      month: activeTasks.filter(isTaskThisMonth).length,
      upcoming: activeTasks.filter(isTaskUpcoming).length,
      overdue: activeTasks.filter(isTaskOverdue).length,
      all: activeTasks.filter((t) => !!t.due_date).length,
    };
  }, [activeTasks]);

  // ─── Filtered Tasks in the Container ─────────────────────────────
  const containerTasks = useMemo(() => {
    // If a specific date is clicked on calendar, prioritize showing that date's tasks
    if (selectedDateStr) {
      return tasksByDate.get(selectedDateStr) || [];
    }

    switch (selectedBucket) {
      case "overdue":
        return activeTasks.filter(isTaskOverdue);
      case "3days":
        return activeTasks.filter((t) => isTaskWithinDays(t, 3));
      case "7days":
        return activeTasks.filter((t) => isTaskWithinDays(t, 7));
      case "week":
        return activeTasks.filter(isTaskThisWeek);
      case "month":
        return activeTasks.filter(isTaskThisMonth);
      case "upcoming":
        return activeTasks.filter(isTaskUpcoming);
      case "all":
      default:
        return activeTasks
          .filter((t) => !!t.due_date)
          .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1));
    }
  }, [activeTasks, selectedDateStr, selectedBucket, tasksByDate]);

  const bucketLabels: Record<
    QuickBucket,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    overdue: {
      label: "Overdue",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    },
    "3days": {
      label: "Within 3 Days",
      icon: <Flame className="w-3.5 h-3.5" />,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    },
    "7days": {
      label: "Within 7 Days",
      icon: <Clock className="w-3.5 h-3.5" />,
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
    },
    week: {
      label: "This Week",
      icon: <CalendarIcon className="w-3.5 h-3.5" />,
      color: "text-violet-400 bg-violet-500/10 border-violet-500/25",
    },
    month: {
      label: "This Month",
      icon: <CalendarIcon className="w-3.5 h-3.5" />,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    },
    upcoming: {
      label: "Upcoming",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    },
    all: {
      label: "All Scheduled",
      icon: <CalendarIcon className="w-3.5 h-3.5" />,
      color: "text-slate-300 bg-slate-800 border-slate-700",
    },
  };

  const handleUpdateTaskDescription = async (newDesc: string) => {
    if (!selectedTask) return;
    const updated = await updateTask(selectedTask.id, {
      description: newDesc,
    });
    setSelectedTask(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-violet-400" />
            Calendar & Deadlines
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visualize your scheduled tasks, deadlines, and upcoming priorities
          </p>
        </div>
      </div>

      {/* ── Main Layout: Calendar Grid + Interactive Container ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main: Month Calendar (8 cols on large screens) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {monthLabel}
              </h2>
              <button
                onClick={goToToday}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 border border-slate-700 transition-all ml-2"
              >
                Today
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-xs font-semibold text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {daysInGrid.map(({ date, dateStr, isCurrentMonth, isToday }) => {
              const dayTasks = tasksByDate.get(dateStr) || [];
              const isSelected = selectedDateStr === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedDateStr(isSelected ? null : dateStr);
                  }}
                  className={`min-h-[85px] sm:min-h-[96px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-violet-950/30 border-violet-500 shadow-md shadow-violet-500/10 ring-1 ring-violet-500"
                      : isToday
                      ? "bg-slate-850/90 border-slate-600/80"
                      : isCurrentMonth
                      ? "bg-slate-850/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/60"
                      : "bg-slate-900/40 border-slate-850/50 text-slate-600 opacity-40 hover:opacity-70"
                  }`}
                >
                  {/* Top: Day number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-violet-600 text-white font-bold"
                          : isCurrentMonth
                          ? "text-slate-300"
                          : "text-slate-600"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Middle: Task chips */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium transition-all ${
                          task.status === "done"
                            ? "line-through text-slate-500 bg-slate-800/60"
                            : task.priority === "high"
                            ? "text-rose-300 bg-rose-500/15 border border-rose-500/25 hover:bg-rose-500/25"
                            : task.priority === "medium"
                            ? "text-amber-300 bg-amber-500/15 border border-amber-500/25 hover:bg-amber-500/25"
                            : "text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] text-slate-500 font-medium pl-0.5">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Bottom: subtle indicator dot if selected */}
                  <div className="h-1 flex justify-center">
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive Container / Quick Bucket Filter (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-violet-400" />
                Timeline Filters
              </h3>
              {selectedDateStr && (
                <button
                  onClick={() => setSelectedDateStr(null)}
                  className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear date
                </button>
              )}
            </div>

            {/* Quick Filter Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {(
                [
                  "3days",
                  "7days",
                  "week",
                  "month",
                  "upcoming",
                  "overdue",
                ] as QuickBucket[]
              ).map((bucket) => {
                const info = bucketLabels[bucket];
                const count = bucketCounts[bucket];
                const isActive =
                  !selectedDateStr && selectedBucket === bucket;

                return (
                  <button
                    key={bucket}
                    onClick={() => {
                      setSelectedDateStr(null);
                      setSelectedBucket(bucket);
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      isActive
                        ? "bg-slate-800 border-violet-500/70 text-slate-100 shadow-sm"
                        : "bg-slate-850/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {info.icon}
                      <span className="truncate">{info.label}</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ml-1 ${
                        bucket === "overdue" && count > 0
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active view label */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between mb-3 text-xs">
              <span className="text-slate-400">
                {selectedDateStr ? (
                  <>
                    Tasks on{" "}
                    <span className="font-semibold text-slate-200">
                      {parseLocalDate(selectedDateStr).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-slate-200">
                      {bucketLabels[selectedBucket].label}
                    </span>
                  </>
                )}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {containerTasks.length} task
                {containerTasks.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Task list in interactive container */}
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {containerTasks.map((task) => {
                const isSelected = selectedTask?.id === task.id;
                const dueDateStatus = getDueDateStatus(
                  task.due_date,
                  task.status === "done"
                );

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-violet-950/25 border-violet-500 shadow-sm"
                        : "bg-slate-850/80 border-slate-750 hover:border-slate-600 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          PRIORITY_STYLES[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            DUE_DATE_STYLES[dueDateStatus]
                          }`}
                        >
                          {formatDueDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    <h4
                      className={`text-sm font-medium leading-snug line-clamp-1 ${
                        task.status === "done"
                          ? "line-through text-slate-400"
                          : "text-slate-200"
                      }`}
                    >
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </div>
                );
              })}

              {containerTasks.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No tasks in this time frame</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Task Details Drawer / Modal ────────────────────────── */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setSelectedTask(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/60 animate-slide-up p-5 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      PRIORITY_STYLES[selectedTask.priority]
                    }`}
                  >
                    {selectedTask.priority}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                    {selectedTask.status.replace("_", " ")}
                  </span>
                  {selectedTask.due_date && (
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        DUE_DATE_STYLES[
                          getDueDateStatus(
                            selectedTask.due_date,
                            selectedTask.status === "done"
                          )
                        ]
                      }`}
                    >
                      {formatDueDate(selectedTask.due_date)}
                    </span>
                  )}
                </div>
                <h3
                  className={`text-base font-semibold leading-snug ${
                    selectedTask.status === "done"
                      ? "line-through text-slate-400"
                      : "text-slate-100"
                  }`}
                >
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description Details Body */}
            <div className="py-4 overflow-y-auto flex-1 space-y-4">
              {selectedTask.description ? (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description & Checklist
                  </h4>
                  <div className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-750">
                    <MarkdownView
                      content={selectedTask.description}
                      onToggleChecklist={handleUpdateTaskDescription}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No description provided for this task.
                </p>
              )}

              {/* Tags */}
              {selectedTask.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTask.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const newStatus =
                    selectedTask.status === "done" ? "todo" : "done";
                  updateTask(selectedTask.id, { status: newStatus });
                  setSelectedTask((prev) =>
                    prev ? { ...prev, status: newStatus } : null
                  );
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedTask.status === "done"
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {selectedTask.status === "done"
                  ? "Reopen Task"
                  : "Mark as Done"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setModalTask(selectedTask);
                    setSelectedTask(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal when triggered from details */}
      <TaskModal
        open={!!modalTask}
        task={modalTask}
        onSave={async (data) => {
          if (modalTask) {
            await updateTask(modalTask.id, data);
            setModalTask(null);
          }
        }}
        onClose={() => setModalTask(null)}
      />
    </div>
  );
}
