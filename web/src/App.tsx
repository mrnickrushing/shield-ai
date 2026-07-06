import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminAPI, clearToken, hydrateToken, setToken } from "./api";
import DashboardPage from "./pages/Dashboard";
import PatternsPage from "./pages/Patterns";
import ReportsPage from "./pages/Reports";
import FeedbackPage from "./pages/Feedback";
import UsersPage from "./pages/Users";
import MarketingPage from "./pages/Marketing";
import SupportPage from "./pages/Support";
import TermsPage from "./pages/Terms";
import PrivacyPage from "./pages/Privacy";

const C = {
  bg: "#020617",
  surface: "#0B1220",
  border: "#1E2A45",
  text: "#F8FAFC",
  muted: "#94A3B8",
  primary: "#3B82F6",
  bright: "#22D3EE",
};

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await AdminAPI.login(email, password);
      setToken(data.access_token);
      await AdminAPI.stats();
      onLogin();
    } catch {
      clearToken();
      setError("Invalid credentials or no admin access.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <form onSubmit={submit} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, width: 360 }}>
        <div style={{ marginBottom: 24 }}>
          <Link to="/" style={{ color: C.muted, textDecoration: "none", fontSize: 13 }}>← Back to Shield AI</Link>
        </div>
        <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Shield AI</h1>
        <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Admin Console — sign in with your admin account</p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16, fontSize: 13 }}>{error}</p>}
        <label htmlFor="admin-email" style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 4 }}>Email</label>
        <input
          id="admin-email"
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginBottom: 12, boxSizing: "border-box", fontSize: 14 }}
        />
        <label htmlFor="admin-password" style={{ display: "block", color: C.muted, fontSize: 12, marginBottom: 4 }}>Password</label>
        <input
          id="admin-password"
          type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginBottom: 20, boxSizing: "border-box", fontSize: 14 }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px 0", backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Checking access..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/admin" && loc.pathname.startsWith(to));
  return (
    <Link to={to} style={{
      display: "block", padding: "8px 16px", borderRadius: 8, textDecoration: "none",
      backgroundColor: active ? C.primary : "transparent",
      color: active ? "#fff" : C.muted, fontWeight: active ? 700 : 400, fontSize: 14, marginBottom: 4,
    }}>
      {label}
    </Link>
  );
}

function AdminLayout({ onLogout, children }: { onLogout: () => void; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <aside style={{ width: 220, backgroundColor: C.surface, borderRight: `1px solid ${C.border}`, padding: 20, flexShrink: 0 }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Shield AI</span>
          <span style={{ color: C.bright, fontSize: 11, fontWeight: 700, marginLeft: 8, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <NavItem to="/admin" label="Dashboard" />
        <NavItem to="/admin/reports" label="Community Reports" />
        <NavItem to="/admin/feedback" label="Feedback Review" />
        <NavItem to="/admin/patterns" label="Scam Patterns" />
        <NavItem to="/admin/users" label="Users" />
        <div style={{ marginTop: 32, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <Link to="/" style={{ display: "block", color: C.muted, textDecoration: "none", fontSize: 13, padding: "4px 16px", marginBottom: 4 }}>
            ← Marketing Site
          </Link>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "4px 16px", display: "block" }}>
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>{children}</main>
    </div>
  );
}

function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verifyExistingSession = async () => {
      const token = hydrateToken();
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        await AdminAPI.stats();
        setAuthed(true);
      } catch {
        clearToken();
        setAuthed(false);
      } finally {
        setChecking(false);
      }
    };

    void verifyExistingSession();
  }, []);

  const logout = () => { clearToken(); setAuthed(false); };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        Verifying admin session...
      </div>
    );
  }

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  return (
    <AdminLayout onLogout={logout}>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="patterns" element={<PatternsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}

export default function App() {
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketingPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
