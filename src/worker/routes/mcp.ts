/**
 * MCP (Model Context Protocol) Handler — Streamable HTTP transport
 *
 * Implements a stateless JSON-RPC 2.0 MCP server at POST /mcp.
 * Authenticated via Bearer token matched against the api_tokens table.
 *
 * Supported methods:
 *   initialize   — capability handshake
 *   tools/list   — advertise available tools
 *   tools/call   — execute a tool
 *
 * Supported tools:
 *   list_tasks          — query tasks with optional status/priority filters
 *   create_task         — create a new task
 *   update_task_status  — change a task's status
 *   delete_task         — permanently delete a task
 */

import type { Context } from "hono";
import { sha256Hex, generateId } from "../utils/crypto";
import type { AppType } from "../index";
import type { ApiToken, Task } from "../db";

// ─── JSON-RPC 2.0 types ───────────────────────────────────────────
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcErr(
  id: JsonRpcRequest["id"],
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ─── Tool definitions (JSON Schema) ──────────────────────────────
const TOOLS = [
  {
    name: "list_tasks",
    description:
      "List the authenticated user's tasks. Optionally filter by status and/or priority.",
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
    description: "Create a new task for the authenticated user.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Optional longer description" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Initial status (default: todo)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level (default: medium)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Array of tag strings",
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
    description: "Update the status of an existing task.",
    inputSchema: {
      type: "object",
      required: ["task_id", "status"],
      properties: {
        task_id: { type: "string", description: "Task ID to update" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "archived"],
          description: "New status",
        },
      },
    },
  },
  {
    name: "delete_task",
    description: "Permanently delete a task by ID.",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "Task ID to delete" },
      },
    },
  },
];

// ─── Main handler ─────────────────────────────────────────────────
export async function mcpHandler(c: Context<AppType>): Promise<Response> {
  // ── Parse JSON-RPC body first ───────────────────────────────────
  let rpc: JsonRpcRequest;
  try {
    rpc = await c.req.json<JsonRpcRequest>();
  } catch {
    return c.json(rpcErr(null, -32700, "Parse error: body must be JSON"), 400);
  }

  const { method, id, params = {} } = rpc;

  // ── Dispatch non-mutating protocol methods ──────────────────────
  switch (method) {
    // Capability handshake
    case "initialize":
      return c.json(
        ok(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "smartboard-mcp", version: "1.0.0" },
        })
      );

    case "notifications/initialized":
      // Client acknowledgment after initialize — no response required in JSON-RPC
      return new Response(null, { status: 204 });

    case "ping":
      return c.json(ok(id, {}));

    case "tools/list":
      return c.json(ok(id, { tools: TOOLS }));

    case "tools/call": {
      // ── Bearer token authentication required for tool execution ──
      const authHeader = c.req.header("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return c.json(
          rpcErr(
            id,
            -32000,
            "Unauthorized: Bearer token required in Authorization header"
          ),
          200
        );
      }

      const rawToken = authHeader.slice(7).trim();
      const tokenHash = await sha256Hex(rawToken);

      const tokenRow = await c.env.DB.prepare(
        "SELECT user_id FROM api_tokens WHERE token_hash = ?"
      )
        .bind(tokenHash)
        .first<Pick<ApiToken, "user_id">>();

      if (!tokenRow) {
        return c.json(
          rpcErr(id, -32000, "Unauthorized: Invalid API token"),
          200
        );
      }

      const userId = tokenRow.user_id;
      const toolName = params.name as string | undefined;
      const args = (params.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) {
        return c.json(rpcErr(id, -32602, "params.name is required"), 400);
      }

      try {
        const result = await executeTool(toolName, args, userId, c.env.DB);
        return c.json(ok(id, result));
      } catch (err) {
        console.error(`MCP tool '${toolName}' error:`, err);
        return c.json(rpcErr(id, -32000, String(err)));
      }
    }

    default:
      return c.json(rpcErr(id, -32601, `Method not found: ${method}`));
  }
}

// ─── Tool execution ───────────────────────────────────────────────
type ToolResult = { content: { type: "text"; text: string }[] };

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  db: D1Database
): Promise<ToolResult> {
  const text = (s: string): ToolResult => ({
    content: [{ type: "text", text: s }],
  });

  switch (name) {
    // ── list_tasks ───────────────────────────────────────────────
    case "list_tasks": {
      const clauses = ["user_id = ?"];
      const params: unknown[] = [userId];

      const validStatuses = ["todo", "in_progress", "done", "archived"];
      const validPriorities = ["low", "medium", "high"];

      if (args.status && validStatuses.includes(args.status as string)) {
        clauses.push("status = ?");
        params.push(args.status);
      }
      if (args.priority && validPriorities.includes(args.priority as string)) {
        clauses.push("priority = ?");
        params.push(args.priority);
      }

      const { results } = await db
        .prepare(
          `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
        )
        .bind(...params)
        .all<Task>();

      const tasks = results.map((t) => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : [],
      }));

      return text(JSON.stringify(tasks, null, 2));
    }

    // ── create_task ──────────────────────────────────────────────
    case "create_task": {
      if (!args.title || typeof args.title !== "string") {
        throw new Error("title (string) is required");
      }

      const validStatuses = ["todo", "in_progress", "done"];
      const validPriorities = ["low", "medium", "high"];
      const status = validStatuses.includes(args.status as string)
        ? args.status
        : "todo";
      const priority = validPriorities.includes(args.priority as string)
        ? args.priority
        : "medium";
      const tags = Array.isArray(args.tags) ? JSON.stringify(args.tags) : null;
      const dueDate = typeof args.due_date === "string" ? args.due_date.trim() || null : null;
      const id = generateId();

      await db
        .prepare(
          `INSERT INTO tasks (id, user_id, title, description, status, priority, tags, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          userId,
          args.title.trim(),
          args.description ?? null,
          status,
          priority,
          tags,
          dueDate
        )
        .run();

      const task = await db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .first<Task>();

      return text(
        `Task created:\n${JSON.stringify(
          { ...task, tags: task?.tags ? JSON.parse(task.tags) : [] },
          null,
          2
        )}`
      );
    }

    // ── update_task_status ───────────────────────────────────────
    case "update_task_status": {
      const validStatuses = ["todo", "in_progress", "done", "archived"];
      if (!args.task_id || typeof args.task_id !== "string") {
        throw new Error("task_id (string) is required");
      }
      if (!args.status || !validStatuses.includes(args.status as string)) {
        throw new Error(`status must be one of: ${validStatuses.join(", ")}`);
      }

      const result = await db
        .prepare(
          "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
        )
        .bind(args.status, args.task_id, userId)
        .run();

      if (result.meta.changes === 0) {
        throw new Error(`Task not found: ${args.task_id}`);
      }

      return text(
        `Task ${args.task_id} status updated to "${args.status}"`
      );
    }

    // ── delete_task ──────────────────────────────────────────────
    case "delete_task": {
      if (!args.task_id || typeof args.task_id !== "string") {
        throw new Error("task_id (string) is required");
      }

      const result = await db
        .prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
        .bind(args.task_id, userId)
        .run();

      if (result.meta.changes === 0) {
        throw new Error(`Task not found: ${args.task_id}`);
      }

      return text(`Task ${args.task_id} deleted`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
