#!/usr/bin/env node
/**
 * MCP Stdio Bridge for Claude Desktop.
 *
 * Claude Desktop communicates over stdio using newline-delimited JSON-RPC 2.0.
 * This bridge handles the handshake locally so Claude Desktop attaches immediately,
 * and routes tool calls to your Smartboard endpoint (or local D1 SQLite fallback).
 */

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const endpoint =
  process.env.SMARTBOARD_URL ||
  process.argv.find((a) => a.startsWith("--url="))?.split("=")[1] ||
  "http://localhost:5173/mcp";

const token =
  process.env.SMARTBOARD_TOKEN ||
  process.argv.find((a) => a.startsWith("--token="))?.split("=")[1] ||
  "";

// ─── Tool Definitions ──────────────────────────────────────────────
const TOOLS = [
  {
    name: "list_tasks",
    description:
      "List the authenticated user's tasks from Smartboard. Optionally filter by status (todo, in_progress, done, archived) or priority (low, medium, high).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "archived"],
          description: "Filter by task status",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Filter by task priority",
        },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task on the Smartboard Kanban board.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Task description / details" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Initial column (default: todo)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Task priority (default: medium)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Array of tag labels, e.g. ['frontend', 'bug']",
        },
        due_date: {
          type: "string",
          description: "Due date in YYYY-MM-DD or ISO format (optional)",
        },
      },
    },
  },
  {
    name: "update_task_status",
    description:
      "Move a task to another status column (todo, in_progress, done, archived).",
    inputSchema: {
      type: "object",
      required: ["task_id", "status"],
      properties: {
        task_id: { type: "string", description: "The ID of the task to update" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "archived"],
          description: "Target column",
        },
      },
    },
  },
  {
    name: "delete_task",
    description: "Permanently delete a task from Smartboard by ID.",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "The ID of the task to delete" },
      },
    },
  },
];

// ─── Local SQLite Fallback Helper ─────────────────────────────────
function getLocalD1Database() {
  try {
    const d1Dir = path.join(
      projectRoot,
      ".wrangler",
      "state",
      "v3",
      "d1",
      "miniflare-D1DatabaseObject"
    );
    if (!fs.existsSync(d1Dir)) return null;

    const files = fs
      .readdirSync(d1Dir)
      .filter((f) => f.endsWith(".sqlite") && !f.startsWith("metadata"));
    if (files.length === 0) return null;

    // Node 22+ built-in sqlite
    const sqlite = awaitImportSqlite();
    if (!sqlite) return null;

    return new sqlite.DatabaseSync(path.join(d1Dir, files[0]));
  } catch (err) {
    process.stderr.write(`[smartboard-bridge] Local SQLite init note: ${err}\n`);
    return null;
  }
}

let sqliteModule = null;
function awaitImportSqlite() {
  if (sqliteModule) return sqliteModule;
  try {
    const { createRequire } = awaitImportRequire();
    const req = createRequire(import.meta.url);
    sqliteModule = req("node:sqlite");
    return sqliteModule;
  } catch {
    return null;
  }
}

function awaitImportRequire() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return import("node:module");
}

async function executeLocalTool(name, args) {
  const sqliteMod = await import("node:sqlite").catch(() => null);
  if (!sqliteMod?.DatabaseSync) {
    throw new Error(
      "Local fallback requires Node.js 22.5+ or a running HTTP server"
    );
  }

  const d1Dir = path.join(
    projectRoot,
    ".wrangler",
    "state",
    "v3",
    "d1",
    "miniflare-D1DatabaseObject"
  );
  if (!fs.existsSync(d1Dir)) {
    throw new Error(
      "Local D1 database not initialized. Run: npx wrangler d1 execute smart-board-db --local --file=migrations/0001_initial.sql"
    );
  }

  const files = fs
    .readdirSync(d1Dir)
    .filter((f) => f.endsWith(".sqlite") && !f.startsWith("metadata"));
  if (files.length === 0) throw new Error("No SQLite database found");

  const db = new sqliteMod.DatabaseSync(path.join(d1Dir, files[0]));

  // Find or create default local user
  let user = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (!user) {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(
      id,
      "local@smartboard.dev"
    );
    user = { id };
  }
  const userId = user.id;

  switch (name) {
    case "list_tasks": {
      const clauses = ["user_id = ?"];
      const params = [userId];
      if (args.status) {
        clauses.push("status = ?");
        params.push(args.status);
      }
      if (args.priority) {
        clauses.push("priority = ?");
        params.push(args.priority);
      }
      const stmt = db.prepare(
        `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
      );
      const rows = stmt.all(...params);
      const tasks = rows.map((r) => ({
        ...r,
        tags: r.tags ? JSON.parse(r.tags) : [],
      }));
      return JSON.stringify(tasks, null, 2);
    }
    case "create_task": {
      const id = crypto.randomUUID();
      const status = args.status || "todo";
      const priority = args.priority || "medium";
      const tags = Array.isArray(args.tags) ? JSON.stringify(args.tags) : null;
      const dueDate = typeof args.due_date === "string" ? args.due_date.trim() || null : null;
      db.prepare(
        `INSERT INTO tasks (id, user_id, title, description, status, priority, tags, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, userId, args.title, args.description || null, status, priority, tags, dueDate);
      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      return JSON.stringify(
        { ...task, tags: task?.tags ? JSON.parse(task.tags) : [] },
        null,
        2
      );
    }
    case "update_task_status": {
      db.prepare(
        "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
      ).run(args.status, args.task_id, userId);
      return `Task ${args.task_id} status updated to "${args.status}"`;
    }
    case "delete_task": {
      db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(
        args.task_id,
        userId
      );
      return `Task ${args.task_id} deleted`;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Main stdio Loop (CRITICAL: Do not set output: process.stdout) ───
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let rpc;
  try {
    rpc = JSON.parse(trimmed);
  } catch (err) {
    process.stderr.write(`[smartboard-bridge] Invalid JSON: ${err}\n`);
    return;
  }

  const { id, method, params = {} } = rpc;

  // 1. Handshake: Always respond positively so Claude Desktop attaches immediately
  if (method === "initialize") {
    const res = {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "smartboard-mcp", version: "1.0.0" },
      },
    };
    process.stdout.write(JSON.stringify(res) + "\n");
    return;
  }

  // 2. Notifications: No response expected in JSON-RPC
  if (method === "notifications/initialized") {
    return;
  }

  // 3. Ping
  if (method === "ping") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: {} }) + "\n");
    return;
  }

  // 4. Tools list
  if (method === "tools/list") {
    const res = {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    };
    process.stdout.write(JSON.stringify(res) + "\n");
    return;
  }

  // 5. Tools call: Try HTTP first; if unavailable, fall back to local D1 SQLite
  if (method === "tools/call") {
    const toolName = params.name;
    const args = params.arguments || {};

    let httpSuccess = false;
    let toolOutput = "";

    // Attempt forwarding to HTTP endpoint
    try {
      const httpRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(rpc),
      });

      if (httpRes.ok) {
        const data = await httpRes.json();
        process.stdout.write(JSON.stringify(data) + "\n");
        return;
      }
    } catch {
      // HTTP fetch failed (e.g. server offline or port not listening)
      httpSuccess = false;
    }

    // Fallback: try direct local SQLite execution
    try {
      const localResult = await executeLocalTool(toolName, args);
      const res = {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: localResult }],
        },
      };
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    } catch (fallbackErr) {
      // Return a clean tool result with instructions rather than crashing JSON-RPC
      const res = {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Smartboard MCP Notice: Could not reach HTTP server at ${endpoint} (${fallbackErr.message}).\n` +
                    `If running locally, please ensure 'npm run dev' is started in your smart-board directory.\n` +
                    `If connecting to production, verify your SMARTBOARD_URL and SMARTBOARD_TOKEN.`,
            },
          ],
          isError: true,
        },
      };
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    }
  }

  // Default fallback for unknown methods
  if (id !== undefined && id !== null) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }) + "\n"
    );
  }
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
