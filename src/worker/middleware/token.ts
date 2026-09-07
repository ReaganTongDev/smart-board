import { createMiddleware } from "hono/factory";
import { sha256Hex } from "../utils/crypto";
import type { AppType } from "../index";
import type { ApiToken } from "../db";

/**
 * Protects routes with a Bearer API token (used by the MCP endpoint).
 * Hashes the raw token with SHA-256 and looks it up in api_tokens.
 * Sets `c.var.userId` on success; returns 401 otherwise.
 */
export const requireToken = createMiddleware<AppType>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "Unauthorized", message: "Bearer token required" },
      401
    );
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return c.json({ error: "Unauthorized", message: "Empty token" }, 401);
  }

  const tokenHash = await sha256Hex(rawToken);

  const row = await c.env.DB.prepare(
    "SELECT user_id FROM api_tokens WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first<Pick<ApiToken, "user_id">>();

  if (!row) {
    return c.json({ error: "Unauthorized", message: "Invalid token" }, 401);
  }

  c.set("userId", row.user_id);
  await next();
});
