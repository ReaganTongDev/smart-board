-- Smartboard D1 Schema — Migration 0001

-- ─────────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- WebAuthn / Passkey credentials
-- One user can have multiple passkeys (phone, laptop, YubiKey, etc.)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id         TEXT    PRIMARY KEY,               -- Credential ID (base64url string from authenticator)
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BLOB    NOT NULL,                  -- COSE-encoded public key (Uint8Array stored as BLOB)
  counter    INTEGER NOT NULL DEFAULT 0,        -- Monotonically increasing; replay / clone detection
  transports TEXT,                              -- JSON array e.g. ["internal","hybrid"]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- Tasks
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT,
  status      TEXT    CHECK(status IN ('todo','in_progress','done','archived')) DEFAULT 'todo',
  priority    TEXT    CHECK(priority IN ('low','medium','high'))                DEFAULT 'medium',
  tags        TEXT,                             -- JSON array of tag strings e.g. ["bug","frontend"]
  due_date    TEXT,                             -- ISO date or date string e.g. "2026-09-10"
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- API tokens (for MCP authentication)
-- Raw token is never stored — only its SHA-256 hex digest
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                     -- SHA-256 hex of the raw bearer token
  name       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_passkey_user    ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user      ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date  ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tokens_hash     ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_user     ON api_tokens(user_id);
