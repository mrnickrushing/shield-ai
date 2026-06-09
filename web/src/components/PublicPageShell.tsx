import React from "react";
import { Link } from "react-router-dom";

const C = {
  bg: "#020617",
  surface: "#0B1220",
  border: "#1E2A45",
  text: "#F8FAFC",
  muted: "#94A3B8",
  primary: "#3B82F6",
};

export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: C.bg, color: C.text, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "0 40px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <Link to="/" style={{ fontWeight: 800, fontSize: 20, color: C.text, textDecoration: "none" }}>Shield AI</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>← Home</Link>
          <Link to="/support" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Support</Link>
        </div>
      </nav>

      <div style={{ flex: 1, maxWidth: 780, margin: "0 auto", width: "100%", padding: "60px 40px", boxSizing: "border-box" }}>
        {children}
      </div>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, flexShrink: 0 }}>
        <span style={{ color: C.muted, fontSize: 13 }}>© {new Date().getFullYear()} Rushing Technologies. All rights reserved.</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link to="/support" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Support</Link>
          <Link to="/terms" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Terms of Service</Link>
          <Link to="/privacy" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
