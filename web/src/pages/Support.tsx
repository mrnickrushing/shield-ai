import { useState } from "react";
import PublicPageShell from "../components/PublicPageShell";
import { C } from "../theme";

const FAQS = [
  {
    q: "How does Shield AI detect scams?",
    a: "Shield AI uses a combination of AI models trained on thousands of real-world scam examples, a community-sourced report database, and a regularly updated pattern library. When you submit content, it's cross-referenced against all three systems to produce a risk score and explanation.",
  },
  {
    q: "What types of content can I scan?",
    a: "You can scan text messages, emails, URLs, and images. Shield AI can analyze phishing links, fake invoice text, suspicious social media messages, romance scam scripts, and more.",
  },
  {
    q: "Is my data kept private?",
    a: "Yes. Submitted content is used only to generate your scan result. We do not sell your data to third parties. See our Privacy Policy for full details.",
  },
  {
    q: "How accurate is the detection?",
    a: "Shield AI achieves over 99% detection accuracy on our test datasets. However, no system is perfect — if you believe a result is incorrect, please use the feedback option to help us improve.",
  },
  {
    q: "How do I report a false positive or false negative?",
    a: "Use the Community Report feature within the app to flag incorrect results. Our team reviews all reports and uses them to continuously improve the detection models.",
  },
  {
    q: "Is Shield AI free to use?",
    a: "Shield AI offers a free tier with standard scan limits. Premium plans are available for higher volume usage and access to the full API.",
  },
  {
    q: "I'm a developer — can I integrate Shield AI into my product?",
    a: "Yes! Shield AI offers a REST API for developers. Contact us at the email below to request API access and documentation.",
  },
];

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: "100%", background: "none", border: "none", color: C.text, padding: "20px 0", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 600 }}
      >
        {q}
        <span style={{ color: C.muted, fontSize: 22, lineHeight: 1, flexShrink: 0, marginLeft: 16 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.75, margin: "0 0 20px", paddingRight: 32 }}>{a}</p>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <PublicPageShell>
      <h1 style={{ fontSize: 42, fontWeight: 900, marginBottom: 12, color: C.text }}>Support</h1>
      <p style={{ color: C.muted, fontSize: 17, lineHeight: 1.7, marginBottom: 56 }}>
        Need help? Browse our frequently asked questions or reach out directly.
      </p>

      {/* Contact card */}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 56, display: "flex", flexWrap: "wrap", gap: 32 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✉️</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Email Support</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>Our team typically responds within 24 hours.</p>
          <a href="mailto:support@shieldai.app" style={{ color: C.bright, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>support@shieldai.app</a>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🐛</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Report a Bug</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>Found a problem? Let us know so we can fix it.</p>
          <a href="mailto:bugs@shieldai.app" style={{ color: C.bright, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>bugs@shieldai.app</a>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Security Issues</h3>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>Please disclose vulnerabilities responsibly.</p>
          <a href="mailto:security@shieldai.app" style={{ color: C.bright, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>security@shieldai.app</a>
        </div>
      </div>

      {/* FAQ */}
      <h2 style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 8 }}>Frequently Asked Questions</h2>
      <p style={{ color: C.muted, fontSize: 15, marginBottom: 32 }}>Quick answers to common questions.</p>
      <div>
        {FAQS.map(faq => <FAQ key={faq.q} {...faq} />)}
      </div>
    </PublicPageShell>
  );
}
