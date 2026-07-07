import { useEffect, useState } from "react";
import { AdminAPI, NotificationDiagnostics } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", danger: "#ef4444", safe: "#22c55e" };

function Stat({ label, value }: { label: string; value: number }) {
  return <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, flex: 1 }}><div style={{ color: C.safe, fontSize: 26, fontWeight: 800 }}>{value.toLocaleString()}</div><div style={{ color: C.muted, fontSize: 12 }}>{label}</div></div>;
}

export default function NotificationsOpsPage() {
  const [data, setData] = useState<NotificationDiagnostics | null>(null);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => AdminAPI.notificationDiagnostics().then(r => setData(r.data)).catch(() => setError("Failed to load notification diagnostics."));
  useEffect(() => { void load(); }, []);

  const sendTest = async () => {
    if (!userId.trim()) return;
    try {
      await AdminAPI.createTestNotification(userId.trim(), "Shield AI test notification", "Support test from the admin console.");
      setMessage("Test notification record created.");
      await load();
    } catch {
      setError("Failed to create test notification.");
    }
  };

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Notification Ops</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>Delivery volume, unread backlog, duplicate alert patterns, and support test notifications.</p>
      {error && <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>}
      {message && <p style={{ color: C.safe, fontSize: 13 }}>{message}</p>}
      {data && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}><Stat label="Total Notifications" value={data.total_notifications} /><Stat label="Unread Notifications" value={data.unread_notifications} /><Stat label="Active Devices" value={data.active_devices} /><Stat label="Identity Alerts" value={data.identity_alerts} /></div>}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 16, marginTop: 0 }}>Send Test Notification Record</h2>
        <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="User id" style={{ width: 360, padding: "8px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginRight: 8 }} />
        <button onClick={sendTest} style={{ backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Create Test</button>
      </div>
      {data && data.possible_duplicates.length > 0 && <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}><h2 style={{ color: C.text, fontSize: 16, marginTop: 0 }}>Possible Duplicate Alerts</h2>{data.possible_duplicates.map((d, i) => <div key={i} style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0", color: C.muted, fontSize: 13 }}><strong style={{ color: C.danger }}>{String(d.count)}x</strong> {String(d.user_email || d.user_id)} — {String(d.title)}</div>)}</div>}
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {(data?.recent_notifications || []).map((n, i) => <div key={String(n.id || i)} style={{ borderBottom: `1px solid ${C.border}`, padding: 14 }}><div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{String(n.title)}</div><div style={{ color: C.muted, fontSize: 12 }}>{String(n.user_email || n.user_id)} · {new Date(String(n.created_at)).toLocaleString()} · {n.is_read ? "read" : "unread"}</div><div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{String(n.body)}</div></div>)}
      </div>
    </div>
  );
}
