import type { Task, TaskStatus, TaskPriority, User, ApiTokenMeta, NewApiToken } from "../types";

// Base API URL: uses VITE_API_URL if configured (for decoupled Pages to Workers),
// or defaults to "/api" (relative) for Pages _redirects proxy or unified Workers.
const API_HOST = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const BASE = `${API_HOST}/api`;

/** Generic fetch wrapper — throws on non-2xx responses */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // send session cookie
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      message = body.error ?? body.detail ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────
const auth = {
  me: () => req<{ user: User | null }>("/auth/me"),

  registerOptions: (email: string) =>
    req<object>("/auth/register/options", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  registerVerify: (body: unknown) =>
    req<{ verified: boolean; user: User }>("/auth/register/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  loginOptions: (email?: string) =>
    req<object>("/auth/login/options", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  loginVerify: (body: unknown) =>
    req<{ verified: boolean; user: User }>("/auth/login/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

// ─── Tasks ────────────────────────────────────────────────────────
const tasks = {
  list: (params?: { status?: TaskStatus; priority?: TaskPriority }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined)
          ) as Record<string, string>
        ).toString()
      : "";
    return req<Task[]>(`/tasks${qs}`);
  },

  create: (data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    tags?: string[];
    due_date?: string | null;
  }) => req<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),

  update: (
    id: string,
    data: Partial<
      Pick<Task, "title" | "description" | "status" | "priority" | "tags" | "due_date">
    >
  ) => req<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    req<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" }),
};

// ─── API Tokens ───────────────────────────────────────────────────
const tokens = {
  list: () => req<ApiTokenMeta[]>("/tokens"),

  create: (name: string) =>
    req<NewApiToken>("/tokens", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    req<{ ok: boolean }>(`/tokens/${id}`, { method: "DELETE" }),
};

export const api = { auth, tasks, tokens };
