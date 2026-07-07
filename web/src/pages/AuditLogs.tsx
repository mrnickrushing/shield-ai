import { useEffect, useState } from "react";
import { AdminAPI, AuditLogEntry } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", danger: "#ef4444" };

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const load = () => AdminAPI.auditLogs(userId || undefined).then(r => setLogs(r.data)).catch(() => setError("Failed to load audit logs."));
  useEffect(() => { void load(); }, []);

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Audit Logs</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>Admin actions, account events, and security-relevant history.</p>
      {error && <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="Filter by user id" style={{ width: 360, padding: "8px 12px", backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
        <button onClick={load} style={{ backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Apply</button>
      </div>
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {logs.map(log => (
          <div key={log.id} style={{ borderBottom: `1px solid ${C.border}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <strong style={{ color: C.text, fontSize: 13 }}>{log.action}</strong>
              <span style={{ color: C.muted, fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{log.user_email || log.user_id || "System/anonymized"}</div>
            <pre style={{ color: C.muted, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(log.detail || {}, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
