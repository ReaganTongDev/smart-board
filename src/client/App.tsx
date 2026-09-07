import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { KanbanBoard } from "./components/KanbanBoard";
import { CalendarPage } from "./components/CalendarPage";
import { ArchivePage } from "./components/ArchivePage";
import { TokensPage } from "./components/TokensPage";
import { NavBar } from "./components/NavBar";

// ─── Spinner ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <main
      role="main"
      aria-label="Loading Smartboard"
      className="min-h-screen bg-slate-950 flex items-center justify-center"
    >
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </main>
  );
}

// ─── Protected layout (redirects to /auth if no session) ─────────
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      {/* pt-14 to clear the fixed top navbar */}
      <main className="pt-14">{children}</main>
    </div>
  );
}

// ─── Auth route guard (redirects to / if already logged in) ──────
function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

// ─── Root app ─────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthGuard />} />
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <KanbanBoard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedLayout>
                <CalendarPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedLayout>
                <ArchivePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/tokens"
            element={
              <ProtectedLayout>
                <TokensPage />
              </ProtectedLayout>
            }
          />
          {/* Catch-all → board */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
