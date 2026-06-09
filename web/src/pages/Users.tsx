import React, { useEffect, useState } from "react";
import { AdminAPI, AdminUser } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", safe: "#22c55e" };

function FlagToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${C.border}`, backgroundColor: value ? C.primary : C.bg, color: value ? "#fff" : C.muted, cursor: "pointer", fontSize: 12, marginRight: 6 }}>
      {label}
    </button>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => { AdminAPI.users().then(r => setUsers(r.data)).catch(() => setError("Failed to load users.")); }, []);

  const update = async (u: AdminUser, field: keyof AdminUser, val: boolean) => {
    const key = `${u.id}:${field}`;
    if (pending[key]) return;
    setPending(prev => ({ ...prev, [key]: true }));
    try {
      await AdminAPI.updateUser(u.id, { [field]: val });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, [field]: val } : x));
    } catch {
      setError("Failed to update user.");
    } finally {
      setPending(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const filtered = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {error && <p style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{error}</p>}
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Users</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>{users.length} accounts</p>
      <input placeholder="Search by email…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: 320, padding: "8px 12px", backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, marginBottom: 20 }} />

      <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Email", "Joined", "Flags", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "12px 16px", color: C.text, fontSize: 13 }}>{u.email}</td>
                <td style={{ padding: "12px 16px", color: C.muted, fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "12px 16px" }}>
                  {u.is_premium && <span style={{ backgroundColor: "#facc1533", color: "#facc15", borderRadius: 999, padding: "2px 8px", fontSize: 11, marginRight: 4 }}>Premium</span>}
                  {u.is_admin && <span style={{ backgroundColor: C.primary + "33", color: C.primary, borderRadius: 999, padding: "2px 8px", fontSize: 11, marginRight: 4 }}>Admin</span>}
                  {u.is_developer && <span style={{ backgroundColor: C.safe + "33", color: C.safe, borderRadius: 999, padding: "2px 8px", fontSize: 11 }}>Developer</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <FlagToggle label="Premium" value={u.is_premium} onChange={v => update(u, "is_premium", v)} />
                  <FlagToggle label="Admin" value={u.is_admin} onChange={v => update(u, "is_admin", v)} />
                  <FlagToggle label="Dev" value={u.is_developer} onChange={v => update(u, "is_developer", v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
