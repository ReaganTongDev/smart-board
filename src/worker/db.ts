// ─── D1 row type definitions ─────────────────────────────────────
// These mirror the SQL schema in migrations/0001_initial.sql

export type User = {
  id: string;
  email: string;
  created_at: string;
};

export type PasskeyCredential = {
  id: string;
  user_id: string;
  /** COSE public key — stored as BLOB, returned by D1 as ArrayBuffer */
  public_key: ArrayBuffer;
  /** Monotonic counter for clone/replay detection */
  counter: number;
  /** JSON-serialised AuthenticatorTransport[] or null */
  transports: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "archived";
  priority: "low" | "medium" | "high";
  /** JSON-serialised string[] or null */
  tags: string | null;
  /** ISO date string e.g. "2026-09-10" or null */
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiToken = {
  id: string;
  user_id: string;
  token_hash: string;
  name: string;
  created_at: string;
};
