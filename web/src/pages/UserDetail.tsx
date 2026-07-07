import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminAPI, AdminUserDetail } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", safe: "#22c55e", danger: "#ef4444" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}><h2 style={{ color: C.text, fontSize: 16, marginTop: 0 }}>{title}</h2>{children}</section>;
}

export default function UserDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const load = () => AdminAPI.userDetail(id).then(r => setData(r.data)).catch(() => setError("Failed to load user detail."));
  useEffect(() => { void load(); }, [id]);

  const revokeSessions = async () => { await AdminAPI.revokeUserSessions(id); await load(); };
  const disableKeys = async () => { await AdminAPI.disableUserApiKeys(id); await load(); };

  if (error) return <p style={{ color: C.danger }}>{error}</p>;
  if (!data) return <p style={{ color: C.muted }}>Loading user...</p>;

  return (
    <div>
      <Link to="/admin/users" style={{ color: C.muted, fontSize: 13 }}>Back to users</Link>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{data.user.email}</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>{data.user.id}</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={revokeSessions} style={{ backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Revoke Sessions</button>
        <button onClick={disableKeys} style={{ backgroundColor: "transparent", color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Disable API Keys</button>
      </div>
      <Panel title="Account Snapshot"><div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: C.muted, fontSize: 13 }}>{Object.entries(data.counts).map(([k, v]) => <span key={k}><strong style={{ color: C.safe }}>{v}</strong> {k.replace(/_/g, " ")}</span>)}</div></Panel>
      <Panel title="Subscription"><pre style={{ color: C.muted, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, whiteSpace: "pre-wrap" }}>{JSON.stringify(data.subscription, null, 2)}</pre></Panel>
      <Panel title="API Keys">{data.api_keys.map(k => <div key={k.id} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}><strong style={{ color: C.text }}>{k.name || k.key_prefix}</strong> · {k.is_active ? "active" : "revoked"} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div>)}</Panel>
      <Panel title="Sessions">{data.sessions.map((s, i) => <div key={String(s.id || i)} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}>{String(s.user_agent || "Unknown device")} · {String(s.ip_address || "no ip")} · {s.is_active ? "active" : "revoked"}</div>)}</Panel>
      <Panel title="Recent Scans">{data.scans.map((s, i) => <div key={String(s.id || i)} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}><strong style={{ color: C.text }}>{String(s.scan_type)}</strong> · {String(s.risk_level || "no report")} · {String(s.raw_input || "").slice(0, 160)}</div>)}</Panel>
      <Panel title="Incidents">{data.incidents.map((item, i) => <div key={String(item.id || i)} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}>{String(item.title || item.incident_type)} · {String(item.status)} · {item.amount_lost ? `$${String(item.amount_lost)}` : "no loss recorded"}</div>)}</Panel>
      <Panel title="Audit Trail">{data.audit_logs.map(log => <div key={log.id} style={{ color: C.muted, borderTop: `1px solid ${C.border}`, padding: "8px 0", fontSize: 13 }}>{log.action} · {new Date(log.created_at).toLocaleString()}</div>)}</Panel>
    </div>
  );
}
