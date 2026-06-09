import { Link } from "react-router-dom";
import { C } from "../theme";

export default function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "36px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Shield AI</span>
        <span style={{ color: C.muted, fontSize: 13 }}>© {new Date().getFullYear()} Rushing Technologies. All rights reserved.</span>
      </div>
      <div style={{ display: "flex", gap: 28 }}>
        <Link to="/support" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Support</Link>
        <Link to="/terms" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Terms of Service</Link>
        <Link to="/privacy" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Privacy Policy</Link>
      </div>
    </footer>
  );
}
