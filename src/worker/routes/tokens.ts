import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { generateId, generateSecureToken, sha256Hex } from "../utils/crypto";
import type { AppType } from "../index";
import type { ApiToken } from "../db";

const tokens = new Hono<AppType>();
tokens.use("*", requireAuth);

// ─── GET /api/tokens ──────────────────────────────────────────────
// Returns token metadata only — never the raw token or its hash
tokens.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, created_at
     FROM api_tokens
     WHERE user_id = ?
     ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<Pick<ApiToken, "id" | "name" | "created_at">>();

  return c.json(results);
});

// ─── POST /api/tokens ─────────────────────────────────────────────
// Generates a new bearer token. The raw token is returned ONCE and
// never stored — only its SHA-256 hash is persisted.
tokens.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string }>();
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Token name is required" }, 400);

  const rawToken = generateSecureToken(); // 256-bit random hex
  const tokenHash = await sha256Hex(rawToken);
  const id = generateId();

  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, user_id, token_hash, name) VALUES (?, ?, ?, ?)"
  )
    .bind(id, userId, tokenHash, name)
    .run();

  // Return the raw token in this response only
  return c.json(
    {
      id,
      name,
      token: rawToken,
      created_at: new Date().toISOString(),
    },
    201
  );
});

// ─── DELETE /api/tokens/:id ───────────────────────────────────────
tokens.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const result = await c.env.DB.prepare(
    "DELETE FROM api_tokens WHERE id = ? AND user_id = ?"
  )
    .bind(c.req.param("id"), userId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Token not found" }, 404);
  }

  return c.json({ ok: true });
});

export { tokens as tokensRoutes };
