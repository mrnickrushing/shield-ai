import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAPI, SubscriptionDiagnostics } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", safe: "#22c55e", danger: "#ef4444" };

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionDiagnostics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { AdminAPI.subscriptionDiagnostics().then(r => setData(r.data)).catch(() => setError("Failed to load subscription diagnostics.")); }, []);
  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Subscription Diagnostics</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>Local premium state, RevenueCat product identifiers, and expired entitlement signals.</p>
      {error && <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>}
      {data && <div style={{ display: "flex", gap: 12, marginBottom: 20 }}><div style={{ color: C.safe }}>Premium: {data.premium_users}</div><div style={{ color: C.muted }}>With product id: {data.with_product_id}</div><div style={{ color: data.expired_premium ? C.danger : C.muted }}>Expired premium: {data.expired_premium}</div></div>}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {(data?.users || []).map(u => <div key={String(u.id)} style={{ borderBottom: `1px solid ${C.border}`, padding: 14, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, color: C.muted, fontSize: 13 }}>
          <Link to={`/admin/users/${String(u.id)}`} style={{ color: C.text }}>{String(u.email)}</Link>
          <span style={{ color: u.status === "premium" ? C.safe : u.status === "expired" ? C.danger : C.muted }}>{String(u.status)}</span>
          <span>{String(u.rc_product_id || "No product id")}</span>
          <span>{u.premium_expires_at ? new Date(String(u.premium_expires_at)).toLocaleDateString() : "No expiration"}</span>
        </div>)}
      </div>
    </div>
  );
}
