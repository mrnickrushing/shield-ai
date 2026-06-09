import { Link } from "react-router-dom";

const C = {
  bg: "#020617",
  surface: "#0B1220",
  border: "#1E2A45",
  text: "#F8FAFC",
  muted: "#94A3B8",
  primary: "#3B82F6",
  bright: "#22D3EE",
};

const FEATURES = [
  {
    icon: "🛡️",
    title: "AI-Powered Detection",
    desc: "Instantly analyze suspicious messages, links, and images with our advanced AI engine trained on thousands of real-world scam patterns.",
  },
  {
    icon: "👥",
    title: "Community Intelligence",
    desc: "Benefit from crowdsourced scam reports. When one person spots a new threat, everyone gets protected automatically.",
  },
  {
    icon: "⚡",
    title: "Real-Time Alerts",
    desc: "Get instant risk warnings before you interact with fraudulent content — no delays, no guesswork.",
  },
  {
    icon: "🔍",
    title: "Pattern Recognition",
    desc: "Our continuously updated pattern library keeps you ahead of the latest scam techniques and social engineering attacks.",
  },
];

const STEPS = [
  { num: "01", title: "Share the Content", desc: "Paste a suspicious message, URL, or upload an image you're unsure about." },
  { num: "02", title: "AI Analyzes It", desc: "Our engine scans against live scam patterns, community reports, and known fraud signals." },
  { num: "03", title: "Get Your Answer", desc: "Receive a clear risk score and plain-language explanation in seconds." },
];

const STATS = [
  { value: "99.2%", label: "Detection Accuracy" },
  { value: "<2s", label: "Average Scan Time" },
  { value: "50K+", label: "Scam Patterns" },
  { value: "24/7", label: "Always On" },
];

export default function MarketingPage() {
  return (
    <div style={{ backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: "100vh" }}>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, backgroundColor: C.bg, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 20, color: C.text }}>Shield AI</span>
          <span style={{ backgroundColor: "#1d4ed8", color: "#bfdbfe", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5 }}>BETA</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#features" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Features</a>
          <a href="#how-it-works" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>How It Works</a>
          <Link to="/support" style={{ color: C.muted, textDecoration: "none", fontSize: 14 }}>Support</Link>
          <Link to="/admin" style={{ backgroundColor: C.primary, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, padding: "8px 18px", borderRadius: 8 }}>
            Admin →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "96px 40px 72px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "#0f2240", border: `1px solid #1d4ed8`, borderRadius: 20, padding: "5px 14px", fontSize: 13, color: C.bright, fontWeight: 600, marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.bright, display: "inline-block" }} />
          AI-Powered Scam Protection
        </div>
        <h1 style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.08, marginBottom: 24, letterSpacing: -1.5, margin: "0 auto 24px" }}>
          Don't Get Scammed.<br />
          <span style={{ color: C.primary }}>Get Shield AI.</span>
        </h1>
        <p style={{ fontSize: 20, color: C.muted, lineHeight: 1.7, margin: "0 auto 44px", maxWidth: 560 }}>
          Instantly detect phishing, fraud, and social engineering attacks before they reach you. Powered by AI trained on real-world threat data.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#how-it-works" style={{ backgroundColor: C.primary, color: "#fff", textDecoration: "none", padding: "14px 32px", borderRadius: 10, fontWeight: 700, fontSize: 16, display: "inline-block" }}>
            See How It Works
          </a>
          <Link to="/support" style={{ backgroundColor: "transparent", color: C.text, textDecoration: "none", padding: "14px 32px", borderRadius: 10, fontWeight: 600, fontSize: 16, border: `1px solid ${C.border}`, display: "inline-block" }}>
            Get Support
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "36px 40px", display: "flex", justifyContent: "center", gap: 72, flexWrap: "wrap" }}>
        {STATS.map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: C.bright }}>{s.value}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "88px 40px", maxWidth: 1120, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 38, fontWeight: 800, marginBottom: 12 }}>Everything You Need to Stay Safe</h2>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 17, marginBottom: 56, margin: "0 auto 56px", maxWidth: 500 }}>
          Built to catch every type of scam before it catches you.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: C.text }}>{f.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ backgroundColor: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "88px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 38, fontWeight: 800, marginBottom: 12 }}>How It Works</h2>
          <p style={{ textAlign: "center", color: C.muted, fontSize: 17, marginBottom: 56 }}>Three steps stand between you and a scam.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 40 }}>
            {STEPS.map(s => (
              <div key={s.num} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 900, color: C.primary, opacity: 0.25, marginBottom: 16, lineHeight: 1 }}>{s.num}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: C.text }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "96px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 42, fontWeight: 900, marginBottom: 16 }}>Ready to Stay Protected?</h2>
        <p style={{ color: C.muted, fontSize: 18, marginBottom: 44 }}>Questions? Our team is here to help.</p>
        <Link to="/support" style={{ backgroundColor: C.primary, color: "#fff", textDecoration: "none", padding: "16px 44px", borderRadius: 12, fontWeight: 700, fontSize: 18, display: "inline-block" }}>
          Contact Support
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "36px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
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

    </div>
  );
}
