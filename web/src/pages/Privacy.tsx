import React from "react";
import PublicPageShell from "../components/PublicPageShell";
import { C } from "../theme";

const h2Style: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: C.text, marginTop: 44, marginBottom: 12 };
const pStyle: React.CSSProperties = { color: C.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 16 };

export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <h1 style={{ fontSize: 42, fontWeight: 900, marginBottom: 8, color: C.text }}>Privacy Policy</h1>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 48, borderBottom: `1px solid ${C.border}`, paddingBottom: 24 }}>
        Last updated: June 2025 — Rushing Technologies
      </p>

      <p style={pStyle}>
        Rushing Technologies ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains what information we collect when you use Shield AI (the "Service"), how we use it, and your rights regarding that information.
      </p>

      <h2 style={h2Style}>1. Information We Collect</h2>
      <p style={pStyle}><strong style={{ color: C.text }}>Account Information:</strong> When you create an account, we collect your email address and a hashed version of your password. We do not store passwords in plaintext.</p>
      <p style={pStyle}><strong style={{ color: C.text }}>Submitted Content:</strong> Text, URLs, and images you submit for scanning. This content is processed to generate a risk assessment and may be retained in anonymized, non-identifiable form to improve our detection models.</p>
      <p style={pStyle}><strong style={{ color: C.text }}>Usage Data:</strong> Information about how you use the Service, including scan counts, feature usage, and timestamps. This data is used to operate, maintain, and improve the Service.</p>
      <p style={pStyle}><strong style={{ color: C.text }}>Device & Technical Data:</strong> IP address, browser type, and operating system. Used for security monitoring and preventing abuse.</p>

      <h2 style={h2Style}>2. How We Use Your Information</h2>
      <ul style={{ ...pStyle, paddingLeft: 24 } as React.CSSProperties}>
        <li style={{ marginBottom: 8 }}>To provide, operate, and improve the Service.</li>
        <li style={{ marginBottom: 8 }}>To process your scan requests and return results.</li>
        <li style={{ marginBottom: 8 }}>To train and improve our AI detection models using anonymized data.</li>
        <li style={{ marginBottom: 8 }}>To communicate with you about your account or the Service.</li>
        <li style={{ marginBottom: 8 }}>To detect and prevent fraud, abuse, or violations of our Terms.</li>
        <li style={{ marginBottom: 8 }}>To comply with legal obligations.</li>
      </ul>

      <h2 style={h2Style}>3. Data Sharing</h2>
      <p style={pStyle}>
        We do not sell your personal data. We may share data with:
      </p>
      <ul style={{ ...pStyle, paddingLeft: 24 } as React.CSSProperties}>
        <li style={{ marginBottom: 8 }}><strong style={{ color: C.text }}>Service Providers:</strong> Trusted third parties who help us operate the Service (hosting, analytics), bound by confidentiality agreements.</li>
        <li style={{ marginBottom: 8 }}><strong style={{ color: C.text }}>Legal Requirements:</strong> When required by law, court order, or to protect the rights and safety of others.</li>
        <li style={{ marginBottom: 8 }}><strong style={{ color: C.text }}>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with appropriate confidentiality protections.</li>
      </ul>

      <h2 style={h2Style}>4. Data Retention</h2>
      <p style={pStyle}>
        We retain account data for as long as your account is active or as needed to provide the Service. Submitted content used for scanning is retained for up to 90 days, after which it is deleted or fully anonymized. You may request earlier deletion at any time.
      </p>

      <h2 style={h2Style}>5. Security</h2>
      <p style={pStyle}>
        We implement industry-standard security measures including encryption in transit (TLS), encrypted storage of sensitive data, and access controls. However, no system is completely secure — if you suspect unauthorized access to your account, contact us immediately.
      </p>

      <h2 style={h2Style}>6. Children's Privacy</h2>
      <p style={pStyle}>
        The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.
      </p>

      <h2 style={h2Style}>7. Your Rights</h2>
      <p style={pStyle}>Depending on your location, you may have the right to:</p>
      <ul style={{ ...pStyle, paddingLeft: 24 } as React.CSSProperties}>
        <li style={{ marginBottom: 8 }}>Access the personal data we hold about you.</li>
        <li style={{ marginBottom: 8 }}>Request correction of inaccurate data.</li>
        <li style={{ marginBottom: 8 }}>Request deletion of your data.</li>
        <li style={{ marginBottom: 8 }}>Object to or restrict certain processing.</li>
        <li style={{ marginBottom: 8 }}>Data portability (receive your data in a machine-readable format).</li>
      </ul>
      <p style={pStyle}>
        To exercise any of these rights, contact us at{" "}
        <a href="mailto:privacy@shieldai.app" style={{ color: C.bright, textDecoration: "none" }}>privacy@shieldai.app</a>.
      </p>

      <h2 style={h2Style}>8. Cookies</h2>
      <p style={pStyle}>
        We use minimal, essential cookies to maintain your session and authentication state. We do not use third-party advertising or tracking cookies.
      </p>

      <h2 style={h2Style}>9. Changes to This Policy</h2>
      <p style={pStyle}>
        We may update this Privacy Policy from time to time. Material changes will be communicated by updating the "Last updated" date. Continued use of the Service after changes indicates acceptance.
      </p>

      <h2 style={h2Style}>10. Contact Us</h2>
      <p style={pStyle}>
        Questions or concerns about this Privacy Policy? Contact our privacy team at{" "}
        <a href="mailto:privacy@shieldai.app" style={{ color: C.bright, textDecoration: "none" }}>privacy@shieldai.app</a>.
      </p>
    </PublicPageShell>
  );
}
