import React from "react";
import PublicPageShell from "../components/PublicPageShell";
import { C } from "../theme";

const h2Style: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: C.text, marginTop: 44, marginBottom: 12 };
const pStyle: React.CSSProperties = { color: C.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 16 };

export default function TermsPage() {
  return (
    <PublicPageShell>
      <h1 style={{ fontSize: 42, fontWeight: 900, marginBottom: 8, color: C.text }}>Terms of Service</h1>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 48, borderBottom: `1px solid ${C.border}`, paddingBottom: 24 }}>
        Last updated: June 2025 — Rushing Technologies
      </p>

      <h2 style={h2Style}>1. Acceptance of Terms</h2>
      <p style={pStyle}>
        By accessing or using Shield AI (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you may not use the Service. These Terms constitute a binding agreement between you and Rushing Technologies ("Company," "we," "us," or "our").
      </p>

      <h2 style={h2Style}>2. Description of Service</h2>
      <p style={pStyle}>
        Shield AI is an AI-powered scam and fraud detection platform that allows users to submit text, URLs, and images for analysis. The Service provides risk assessments and educational information to help users identify potentially fraudulent content.
      </p>
      <p style={pStyle}>
        The Service is provided for informational and protective purposes only. Shield AI's risk assessments are not legal advice and should not be relied upon as the sole basis for any decision.
      </p>

      <h2 style={h2Style}>3. Eligibility</h2>
      <p style={pStyle}>
        You must be at least 13 years of age to use the Service. By using the Service, you represent and warrant that you meet this requirement and that all information you provide is accurate and complete.
      </p>

      <h2 style={h2Style}>4. Acceptable Use</h2>
      <p style={pStyle}>You agree not to use the Service to:</p>
      <ul style={{ ...pStyle, paddingLeft: 24 } as React.CSSProperties}>
        <li style={{ marginBottom: 8 }}>Submit content that violates any applicable law or regulation.</li>
        <li style={{ marginBottom: 8 }}>Probe, test, or circumvent the security of our systems.</li>
        <li style={{ marginBottom: 8 }}>Submit content containing personal data of others without authorization.</li>
        <li style={{ marginBottom: 8 }}>Use automated tools to scrape or overload the Service.</li>
        <li style={{ marginBottom: 8 }}>Misuse community reporting features by submitting false or misleading reports.</li>
        <li style={{ marginBottom: 8 }}>Reverse-engineer, copy, or redistribute any part of the Service.</li>
      </ul>

      <h2 style={h2Style}>5. Intellectual Property</h2>
      <p style={pStyle}>
        All content, features, and functionality of the Service — including the AI models, scam pattern database, software, text, and graphics — are owned by Rushing Technologies and are protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.
      </p>

      <h2 style={h2Style}>6. Submitted Content</h2>
      <p style={pStyle}>
        When you submit content for scanning, you grant us a limited, non-exclusive license to process that content solely for the purpose of providing the Service. We do not claim ownership of submitted content. Submitted content may be used in anonymized, aggregated form to improve detection models. See our Privacy Policy for full details.
      </p>

      <h2 style={h2Style}>7. Disclaimer of Warranties</h2>
      <p style={pStyle}>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT DETECTION RESULTS WILL BE ACCURATE IN ALL CASES. USE OF THE SERVICE IS AT YOUR OWN RISK.
      </p>

      <h2 style={h2Style}>8. Limitation of Liability</h2>
      <p style={pStyle}>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RUSHING TECHNOLOGIES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>

      <h2 style={h2Style}>9. Changes to Terms</h2>
      <p style={pStyle}>
        We reserve the right to modify these Terms at any time. We will notify users of material changes by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the revised Terms.
      </p>

      <h2 style={h2Style}>10. Contact</h2>
      <p style={pStyle}>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:legal@shieldai.app" style={{ color: C.bright, textDecoration: "none" }}>legal@shieldai.app</a>.
      </p>
    </PublicPageShell>
  );
}
