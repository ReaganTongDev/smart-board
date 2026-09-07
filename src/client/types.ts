// ─── Shared TypeScript types (mirrors the D1 schema) ─────────────

export type TaskStatus = "todo" | "in_progress" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Deserialized from JSON string stored in D1 */
  tags: string[];
  /** Due date as ISO string or YYYY-MM-DD or null */
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface ApiTokenMeta {
  id: string;
  name: string;
  created_at: string;
}

export interface NewApiToken extends ApiTokenMeta {
  /** Raw bearer token — returned by POST /api/tokens only once */
  token: string;
}
