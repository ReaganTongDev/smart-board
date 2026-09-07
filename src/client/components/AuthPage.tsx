import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  Monitor,
  Shield,
  Smartphone,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "register";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // WebAuthn is required — show a fallback if the browser doesn't support it
  if (!browserSupportsWebAuthn()) {
    return (
      <main
        role="main"
        className="min-h-screen bg-slate-950 flex items-center justify-center p-4"
      >
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Browser not supported
          </h2>
          <p className="text-slate-300 text-sm">
            Smartboard requires WebAuthn / Passkey support. Please use a modern
            browser such as Chrome, Safari, Firefox, or Edge.
          </p>
        </div>
      </main>
    );
  }

  // ─── Registration ──────────────────────────────────────────────
  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Get options from server (stores challenge in signed cookie)
      const optionsJSON = await api.auth.registerOptions(trimmedEmail);

      // 2. Trigger native passkey UI — must be in user gesture context
      const regResponse = await startRegistration({
        optionsJSON:
          optionsJSON as Parameters<typeof startRegistration>[0]["optionsJSON"],
      });

      // 3. Verify on server and receive session cookie
      const result = await api.auth.registerVerify(regResponse);
      setUser(result.user);
      navigate("/");
    } catch (e) {
      // User-facing error: could be "User cancelled" or a server error
      const msg = e instanceof Error ? e.message : "Registration failed";
      // Don't show "The operation either timed out or was not allowed" as an error
      if (!msg.includes("timed out") && !msg.includes("not allowed")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Authentication ────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get options (email is optional — omit for passkey discovery mode)
      const optionsJSON = await api.auth.loginOptions(
        email.trim() || undefined
      );

      // 2. Trigger native passkey picker
      const authResponse = await startAuthentication({
        optionsJSON:
          optionsJSON as Parameters<
            typeof startAuthentication
          >[0]["optionsJSON"],
      });

      // 3. Verify signature and receive session
      const result = await api.auth.loginVerify(authResponse);
      setUser(result.user);
      navigate("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      if (!msg.includes("timed out") && !msg.includes("not allowed")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () =>
    mode === "register" ? handleRegister() : handleLogin();

  // ─── Render ────────────────────────────────────────────────────
  return (
    <main
      role="main"
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 rounded-2xl mb-4 border border-violet-500/20">
            <KeyRound className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Smartboard
          </h1>
          <p className="text-slate-300 text-sm mt-1">Your Kanban workspace</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl shadow-black/40">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-slate-800 p-1 mb-6">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? "bg-slate-700 text-slate-100 shadow-sm"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Email field */}
          <div className="mb-4">
            <label
              htmlFor="auth-email"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              {mode === "login" ? (
                <>
                  Email{" "}
                  <span className="text-slate-300 font-normal">
                    (optional — leave blank for passkey discovery)
                  </span>
                </>
              ) : (
                <>
                  Email <span className="text-rose-400">*</span>
                </>
              )}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !loading && void handleSubmit()
              }
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all text-sm"
            />
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-3.5 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for passkey…
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                {mode === "login"
                  ? "Sign in with Passkey"
                  : "Register with Passkey"}
              </>
            )}
          </button>
        </div>

        {/* Supported authenticators */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-300 font-medium mb-3">Works with</p>
          <div className="flex items-center justify-center gap-5 flex-wrap">
            {[
              { Icon: Smartphone, label: "Face ID / Touch ID" },
              { Icon: Monitor, label: "Windows Hello" },
              { Icon: Shield, label: "YubiKey" },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-slate-300"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
