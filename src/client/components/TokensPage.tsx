import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCheck,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "../api/client";
import type { ApiTokenMeta, NewApiToken } from "../types";

export function TokensPage() {
  const [tokens, setTokens] = useState<ApiTokenMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // New token creation form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Reveal panel for the just-created token (raw value shown once)
  const [revealed, setRevealed] = useState<NewApiToken | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Token deletion
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.tokens
      .list()
      .then(setTokens)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const result = await api.tokens.create(name);
      setTokens((prev) => [{ id: result.id, name: result.name, created_at: result.created_at }, ...prev]);
      setRevealed(result);
      setShowRaw(false);
      setCopied(false);
      setNewName("");
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.tokens.delete(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (revealed?.id === id) setRevealed(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-5 h-5 text-slate-400" />
          <h1 className="text-xl font-bold text-slate-100">API Tokens</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Bearer tokens for authenticating to the{" "}
          <code className="text-violet-400 text-xs font-mono">/mcp</code> MCP
          endpoint
        </p>
      </div>

      {/* ── Newly-created token reveal ─────────────────────────── */}
      {revealed && (
        <div className="mb-6 bg-emerald-500/8 border border-emerald-500/25 rounded-xl p-4 animate-slide-up">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Token "{revealed.name}" created
              </p>
              <p className="text-xs text-emerald-400/70 mt-0.5">
                Copy this token now — it will never be shown again.
              </p>
            </div>
          </div>

          {/* Token display */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5">
            <code className="flex-1 text-xs text-slate-300 font-mono break-all leading-relaxed">
              {showRaw ? revealed.token : "•".repeat(64)}
            </code>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="text-slate-500 hover:text-slate-300 transition-all shrink-0"
              title={showRaw ? "Hide" : "Show"}
            >
              {showRaw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => void handleCopy()}
              className={`transition-all shrink-0 ${
                copied ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
              }`}
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCheck className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          <button
            onClick={() => setRevealed(null)}
            className="mt-3 text-xs text-slate-500 hover:text-slate-400 transition-all"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Create form ────────────────────────────────────────── */}
      <form onSubmit={(e) => void handleCreate(e)} className="mb-6 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder='Token name, e.g. "Claude Desktop"'
          className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all text-sm"
        />
        <button
          type="submit"
          disabled={!newName.trim() || creating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-sm shrink-0"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {creating ? "Generating…" : "Generate"}
        </button>
      </form>

      {/* ── Token list ─────────────────────────────────────────── */}
      {tokens.length === 0 ? (
        <div className="text-center py-20">
          <Key className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No API tokens yet</p>
          <p className="text-slate-600 text-xs mt-1">
            Generate a token to use the MCP integration
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 transition-all hover:border-slate-600/60"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {token.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Created{" "}
                  {new Date(token.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => void handleDelete(token.id)}
                disabled={deletingId === token.id}
                className="p-2 ml-3 shrink-0 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all disabled:opacity-40"
                title="Revoke token"
              >
                {deletingId === token.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── MCP usage hint ─────────────────────────────────────── */}
      <div className="mt-8 p-4 bg-slate-900 border border-slate-700/50 rounded-xl">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          MCP Endpoint
        </h3>
        <div className="space-y-2 text-xs font-mono text-slate-400">
          <div>
            <span className="text-slate-600">POST </span>
            <span className="text-violet-400">
              {typeof window !== "undefined" ? window.location.origin : ""}/mcp
            </span>
          </div>
          <div>
            <span className="text-slate-600">Content-Type: </span>
            application/json
          </div>
          <div>
            <span className="text-slate-600">Authorization: </span>
            Bearer{" "}
            <span className="text-emerald-400">&lt;your-token&gt;</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            Supports{" "}
            <code className="text-violet-400">initialize</code>,{" "}
            <code className="text-violet-400">tools/list</code>, and{" "}
            <code className="text-violet-400">tools/call</code> (JSON-RPC 2.0)
          </p>
        </div>
      </div>
    </div>
  );
}
