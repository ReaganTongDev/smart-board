import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { authRoutes } from "./routes/auth";
import { tasksRoutes } from "./routes/tasks";
import { tokensRoutes } from "./routes/tokens";
import { mcpHandler } from "./routes/mcp";

// ─── Cloudflare Worker bindings ──────────────────────────────────
export type Bindings = {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** HMAC key for signing session + challenge cookies */
  SESSION_SECRET: string;
  /** WebAuthn Relying Party hostname (e.g. "localhost" or "smart-board.pages.dev") */
  RP_ID: string;
  /** Full origin for WebAuthn verification (e.g. "https://smart-board.pages.dev") */
  ORIGIN: string;
};

// ─── Per-request context variables (set by auth middleware) ──────
export type Variables = {
  userId: string;
};

export type AppType = { Bindings: Bindings; Variables: Variables };

// ─── App ─────────────────────────────────────────────────────────
const app = new Hono<AppType>();

// 1. Security Headers — applies strict headers on all responses
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.workers.dev https://*.pages.dev; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
  );
});

// 2. Block sensitive probes and scanner queries (e.g. /.env, /config.json, *.map, /.git/*)
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const path = url.pathname.toLowerCase();

  const isSensitiveProbe =
    path.startsWith("/.") ||
    path.includes("/.") ||
    path.endsWith(".env") ||
    path.endsWith(".map") ||
    path.endsWith(".sql") ||
    path.endsWith(".bak") ||
    path.endsWith(".conf") ||
    path.endsWith(".ini") ||
    path.endsWith(".log") ||
    path.endsWith(".yml") ||
    path.endsWith(".yaml") ||
    path === "/config.json" ||
    path === "/api/config" ||
    path === "/package.json" ||
    path.includes(".git") ||
    path.includes(".htaccess") ||
    (path.endsWith(".json") &&
      (path.includes("config") ||
        path.includes("secret") ||
        path.includes("setting") ||
        path.includes("package")));

  if (isSensitiveProbe) {
    return c.text("Not Found", 404);
  }

  await next();
});

// CORS — allow same-origin browser requests + Pages frontend domain
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      // Allow requests from same-origin, configured ORIGIN, or local dev
      if (!origin) return "*";
      if (c.env.ORIGIN && origin === c.env.ORIGIN) return origin;
      if (origin.includes("localhost") || origin.includes("127.0.0.1")) return origin;
      if (origin.endsWith(".pages.dev") || origin.endsWith(".workers.dev")) return origin;
      return origin;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// CSRF — validates Origin / Sec-Fetch-Site headers on mutating requests.
// Configured to allow both same-origin requests and the frontend Pages ORIGIN.
app.use(
  "/api/tasks/*",
  csrf({
    origin: (origin, c) => {
      if (!origin) return true;
      try {
        const reqOrigin = new URL(c.req.url).origin;
        if (origin === reqOrigin) return true;
        if (c.env.ORIGIN && origin === c.env.ORIGIN) return true;
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
        if (origin.endsWith(".pages.dev")) return true;
      } catch {
        // ignore URL parse errors
      }
      return false;
    },
  })
);

app.use(
  "/api/tokens/*",
  csrf({
    origin: (origin, c) => {
      if (!origin) return true;
      try {
        const reqOrigin = new URL(c.req.url).origin;
        if (origin === reqOrigin) return true;
        if (c.env.ORIGIN && origin === c.env.ORIGIN) return true;
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
        if (origin.endsWith(".pages.dev")) return true;
      } catch {
        // ignore
      }
      return false;
    },
  })
);

// Health check endpoint
app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    service: "smartboard-api",
    timestamp: new Date().toISOString(),
  })
);

// ─── Route mounts ────────────────────────────────────────────────
app.route("/api/auth", authRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/tokens", tokensRoutes);

// MCP endpoint — Bearer token authenticated
app.all("/mcp", mcpHandler);

// 404 for unmatched /api routes (prevent falling through to SPA index.html)
app.all("/api/*", (c) => {
  return c.json({ error: "Endpoint not found" }, 404);
});

// ─── Fallback ────────────────────────────────────────────────────
// If ASSETS binding is present (unified deployment), serve static files.
// If deployed as a standalone API worker, return a friendly status JSON.
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    const path = new URL(c.req.url).pathname;
    const contentType = res.headers.get("content-type") || "";

    // If an asset in /assets/ was requested but not found (SPA fallback would return index.html), return 404
    if (path.startsWith("/assets/") && contentType.includes("text/html")) {
      return c.text("Asset Not Found", 404);
    }

    // Attach security headers to static asset responses as well
    const newHeaders = new Headers(res.headers);
    newHeaders.set("X-Content-Type-Options", "nosniff");
    newHeaders.set("X-Frame-Options", "SAMEORIGIN");
    newHeaders.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
    newHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    newHeaders.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.workers.dev https://*.pages.dev; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
    );

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  }

  return c.json({
    name: "smartboard-api",
    status: "ok",
    message:
      "Smartboard Hono API Worker is active. React frontend is deployed on Cloudflare Pages.",
  });
});

export default app;
