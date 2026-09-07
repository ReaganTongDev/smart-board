import { Link, useLocation } from "react-router-dom";
import { Archive, Calendar, Key, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { to: "/", label: "Board", Icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", Icon: Calendar },
  { to: "/archive", label: "Archive", Icon: Archive },
  { to: "/tokens", label: "API Tokens", Icon: Key },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* ── Logo ─────────────────────────────────────────── */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-100 text-sm tracking-tight hidden xs:block">
            Smartboard
          </span>
        </Link>

        {/* ── Nav links ─────────────────────────────────────── */}
        <nav className="flex items-center gap-0.5">
          {NAV_LINKS.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── User + sign out ───────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:block text-xs text-slate-500 truncate max-w-[160px]">
            {user?.email}
          </span>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
