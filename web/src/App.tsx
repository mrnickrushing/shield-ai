import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminAPI, clearToken, setToken } from "./api";
import DashboardPage from "./pages/Dashboard";
import PatternsPage from "./pages/Patterns";
import ReportsPage from "./pages/Reports";
import UsersPage from "./pages/Users";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await AdminAPI.login(email, password);
      setToken(data.access_token);
      onLogin();
    } catch {
      setError("Invalid credentials or no admin access.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, width: 360 }}>
        <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Shield AI</h1>
        <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Admin Console — sign in with your admin account</p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16, fontSize: 13 }}>{error}</p>}
        <input
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginBottom: 12, boxSizing: "border-box", fontSize: 14 }}
        />
        <input
          type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginBottom: 20, boxSizing: "border-box", fontSize: 14 }}
        />
        <button type="submit" style={{ width: "100%", padding: "10px 0", backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Sign In
        </button>
      </form>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to;
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

function Layout({ onLogout, children }: { onLogout: () => void; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: C.bg }}>
      <aside style={{ width: 220, backgroundColor: C.surface, borderRight: `1px solid ${C.border}`, padding: 20, flexShrink: 0 }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Shield AI</span>
          <span style={{ color: C.bright, fontSize: 11, fontWeight: 700, marginLeft: 8, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <NavItem to="/" label="Dashboard" />
        <NavItem to="/reports" label="Community Reports" />
        <NavItem to="/patterns" label="Scam Patterns" />
        <NavItem to="/users" label="Users" />
        <button onClick={onLogout} style={{ marginTop: 32, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "8px 16px" }}>
          Sign out
        </button>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>{children}</main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("admin_token"));

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }, []);

  const logout = () => { clearToken(); setAuthed(false); };

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;

  return (
    <BrowserRouter>
      <Layout onLogout={logout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
