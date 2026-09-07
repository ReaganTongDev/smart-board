import { createMiddleware } from "hono/factory";
import { getSignedCookie } from "hono/cookie";
import type { AppType } from "../index";

/**
 * Protects routes with a signed session cookie.
 * Sets `c.var.userId` on success; returns 401 otherwise.
 */
export const requireAuth = createMiddleware<AppType>(async (c, next) => {
  const userId = await getSignedCookie(c, c.env.SESSION_SECRET, "session");
  if (!userId) {
    return c.json({ error: "Unauthorized", message: "Session required" }, 401);
  }
  c.set("userId", userId);
  await next();
});
