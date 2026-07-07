import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAPI, AdminApiKey } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", safe: "#22c55e", danger: "#ef4444" };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const load = () => AdminAPI.apiKeys(filter || undefined).then(r => setKeys(r.data)).catch(() => setError("Failed to load API keys."));
  useEffect(() => { void load(); }, [filter]);

  const toggle = async (key: AdminApiKey) => {
    try {
      await AdminAPI.updateApiKey(key.id, !key.is_active);
      setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !key.is_active } : k));
    } catch {
      setError("Failed to update API key.");
    }
  };

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>API Keys</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>Developer key inventory, status, scopes, and last-use diagnostics.</p>
      {error && <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>}
      <select value={filter} onChange={e => setFilter(e.target.value)} style={{ backgroundColor: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
        <option value="">All keys</option>
        <option value="active">Active</option>
        <option value="revoked">Revoked</option>
      </select>
      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Owner", "Name", "Prefix", "Scopes", "Last Used", "Status"].map(h => <th key={h} style={{ padding: 12, textAlign: "left", color: C.muted, fontSize: 12 }}>{h.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {keys.map(key => (
              <tr key={key.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: 12, fontSize: 13 }}><Link to={`/admin/users/${key.user_id}`} style={{ color: C.text }}>{key.user_email || key.user_id}</Link></td>
                <td style={{ padding: 12, color: C.text, fontSize: 13 }}>{key.name || "Unnamed key"}</td>
                <td style={{ padding: 12, color: C.muted, fontSize: 12 }}>{key.key_prefix}</td>
                <td style={{ padding: 12, color: C.muted, fontSize: 12 }}>{(key.scopes || []).join(", ") || "none"}</td>
                <td style={{ padding: 12, color: C.muted, fontSize: 12 }}>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}</td>
                <td style={{ padding: 12 }}>
                  <button onClick={() => toggle(key)} style={{ border: `1px solid ${key.is_active ? C.safe : C.danger}`, color: key.is_active ? C.safe : C.danger, background: "transparent", borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}>
                    {key.is_active ? "Active" : "Revoked"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
