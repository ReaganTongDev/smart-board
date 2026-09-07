import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { generateId } from "../utils/crypto";
import type { AppType } from "../index";
import type { Task } from "../db";

const tasks = new Hono<AppType>();
tasks.use("*", requireAuth);

const VALID_STATUSES = ["todo", "in_progress", "done", "archived"] as const;
const VALID_PRIORITIES = ["low", "medium", "high"] as const;

type TaskStatus = (typeof VALID_STATUSES)[number];
type TaskPriority = (typeof VALID_PRIORITIES)[number];

/** Parse task row from D1, converting JSON tags string → string[] */
function parseTask(t: Task) {
  return { ...t, tags: t.tags ? (JSON.parse(t.tags) as string[]) : [] };
}

// ─── GET /api/tasks ───────────────────────────────────────────────
tasks.get("/", async (c) => {
  const userId = c.get("userId");
  const { status, priority } = c.req.query();

  const clauses: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (status && VALID_STATUSES.includes(status as TaskStatus)) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (priority && VALID_PRIORITIES.includes(priority as TaskPriority)) {
    clauses.push("priority = ?");
    params.push(priority);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
  )
    .bind(...params)
    .all<Task>();

  return c.json(results.map(parseTask));
});

// ─── POST /api/tasks ──────────────────────────────────────────────
tasks.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    tags?: string[];
    due_date?: string | null;
  }>();

  const title = body.title?.trim();
  if (!title) return c.json({ error: "Title is required" }, 400);

  const status: TaskStatus = VALID_STATUSES.includes(body.status as TaskStatus)
    ? (body.status as TaskStatus)
    : "todo";
  const priority: TaskPriority = VALID_PRIORITIES.includes(
    body.priority as TaskPriority
  )
    ? (body.priority as TaskPriority)
    : "medium";
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;
  const dueDate = body.due_date?.trim() || null;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, user_id, title, description, status, priority, tags, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, title, body.description?.trim() ?? null, status, priority, tags, dueDate)
    .run();

  const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?")
    .bind(id)
    .first<Task>();

  return c.json(parseTask(task!), 201);
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────
tasks.get("/:id", async (c) => {
  const userId = c.get("userId");
  const task = await c.env.DB.prepare(
    "SELECT * FROM tasks WHERE id = ? AND user_id = ?"
  )
    .bind(c.req.param("id"), userId)
    .first<Task>();

  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json(parseTask(task));
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────
tasks.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM tasks WHERE id = ? AND user_id = ?"
  )
    .bind(taskId, userId)
    .first<Task>();

  if (!existing) return c.json({ error: "Task not found" }, 404);

  const body = await c.req.json<{
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    tags?: string[];
    due_date?: string | null;
  }>();

  const title = body.title?.trim() ?? existing.title;
  const description =
    "description" in body ? (body.description ?? null) : existing.description;
  const status = VALID_STATUSES.includes(body.status as TaskStatus)
    ? (body.status as TaskStatus)
    : existing.status;
  const priority = VALID_PRIORITIES.includes(body.priority as TaskPriority)
    ? (body.priority as TaskPriority)
    : existing.priority;
  const tags =
    "tags" in body && Array.isArray(body.tags)
      ? JSON.stringify(body.tags)
      : existing.tags;
  const dueDate =
    "due_date" in body ? (body.due_date?.trim() || null) : existing.due_date;

  await c.env.DB.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, priority = ?, tags = ?, due_date = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`
  )
    .bind(title, description, status, priority, tags, dueDate, taskId, userId)
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<Task>();

  return c.json(parseTask(updated!));
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────
tasks.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const result = await c.env.DB.prepare(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?"
  )
    .bind(c.req.param("id"), userId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ ok: true });
});

export { tasks as tasksRoutes };
