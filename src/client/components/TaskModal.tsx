import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  Eye,
  PenLine,
  Plus,
  X,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "../types";
import { MarkdownView } from "./MarkdownView";

interface TaskModalProps {
  open: boolean;
  task?: Task | null;
  defaultStatus?: TaskStatus;
  onSave: (
    data: Pick<
      Task,
      "title" | "description" | "status" | "priority" | "tags" | "due_date"
    >
  ) => Promise<void>;
  onClose: () => void;
}

export function TaskModal({
  open,
  task,
  defaultStatus = "todo",
  onSave,
  onClose,
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Populate form when opening
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status === "archived" ? "todo" : task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setTags(task.tags ?? []);
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority("medium");
      setDueDate("");
      setTags([]);
    }
    setTagInput("");
    setDescTab("write");
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, task, defaultStatus]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags((p) => p.filter((t) => t !== tag));

  // Quick due date helpers
  const setQuickDate = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setDueDate(`${yyyy}-${mm}-${dd}`);
  };

  const insertChecklist = () => {
    const prefix = description ? (description.endsWith("\n") ? "" : "\n") : "";
    setDescription((prev) => `${prev}${prefix}- [ ] `);
    setDescTab("write");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        tags,
        due_date: dueDate ? dueDate : null,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all text-sm";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={task ? "Edit task" : "New task"}
    >
      <div className="bg-slate-900 border border-slate-700/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl shadow-black/60 animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 shrink-0">
          <h2 className="text-base font-semibold text-slate-100">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body (scrollable) */}
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className={inputCls}
              required
            />
          </div>

          {/* Description with Markdown Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Description (Markdown)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={insertChecklist}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 mr-1"
                  title="Insert a checklist item (- [ ] )"
                >
                  <CheckSquare className="w-3 h-3" />
                  + Item
                </button>
                <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-750">
                  <button
                    type="button"
                    onClick={() => setDescTab("write")}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      descTab === "write"
                        ? "bg-slate-700 text-slate-100"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <PenLine className="w-3 h-3" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescTab("preview")}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      descTab === "preview"
                        ? "bg-slate-700 text-slate-100"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                </div>
              </div>
            </div>

            {descTab === "write" ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context, markdown, or checklists (- [ ] task)…"
                rows={4}
                className={`${inputCls} resize-none font-mono text-xs`}
              />
            ) : (
              <div className="min-h-[96px] p-3 bg-slate-800/80 border border-slate-700 rounded-xl max-h-48 overflow-y-auto">
                {description.trim() ? (
                  <MarkdownView content={description} />
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Nothing to preview
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={inputCls}
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={inputCls}
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>

          {/* Due Date & Shortcuts */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
                <Calendar className="w-4 h-4 text-slate-400" />
                Due Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                >
                  +1 Week
                </button>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="text-[11px] px-1.5 py-0.5 text-rose-400 hover:text-rose-300"
                    title="Clear due date"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                  if (e.key === "," || e.key === " ") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type tag and press Enter"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all"
                aria-label="Add tag"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600/50"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-slate-400 hover:text-slate-100 transition-all"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-violet-500/20"
            >
              {saving ? "Saving…" : task ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
