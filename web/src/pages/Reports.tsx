import React, { useEffect, useState } from "react";
import { AdminAPI, CommunityReport } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", safe: "#22c55e", warn: "#f97316", crit: "#ef4444" };

const STATUS_COLORS: Record<string, string> = { pending: C.warn, reviewed: C.primary, approved: C.safe, rejected: C.crit };

function Badge({ s }: { s: string }) {
  return <span style={{ backgroundColor: STATUS_COLORS[s] ?? C.muted, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{s}</span>;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<CommunityReport | null>(null);
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("reviewed");

  const load = () => AdminAPI.reports(filter || undefined).then(r => setReports(r.data));

  useEffect(() => { load(); }, [filter]);

  const submit = async () => {
    if (!selected) return;
    await AdminAPI.reviewReport(selected.id, newStatus, notes);
    setSelected(null);
    setNotes("");
    load();
  };

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Community Reports</h1>
      <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Review user-submitted scam pattern reports</p>

      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {["pending", "reviewed", "approved", "rejected", ""].map(s => (
          <button key={s || "all"} onClick={() => setFilter(s)}
            style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${C.border}`, backgroundColor: filter === s ? C.primary : C.surface, color: filter === s ? "#fff" : C.muted, cursor: "pointer", fontSize: 13 }}>
            {s || "All"}
          </button>
        ))}
      </div>

      {reports.length === 0 && <p style={{ color: C.muted }}>No reports found.</p>}

      {reports.map(r => (
        <div key={r.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <span style={{ color: C.text, fontWeight: 700, marginRight: 10 }}>{r.report_type}</span>
              <Badge s={r.status} />
              {r.category && <span style={{ color: C.muted, fontSize: 12, marginLeft: 10 }}>{r.category}</span>}
              {r.platform_hint && <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>· {r.platform_hint}</span>}
            </div>
            <span style={{ color: C.muted, fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          {r.artifact_text && (
            <div style={{ backgroundColor: C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: C.muted, fontFamily: "monospace", maxHeight: 120, overflow: "auto" }}>
              {r.artifact_text}
            </div>
          )}
          {r.analyst_notes && <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>Notes: {r.analyst_notes}</p>}
          <button onClick={() => { setSelected(r); setNotes(r.analyst_notes); setNewStatus("reviewed"); }}
            style={{ padding: "5px 14px", borderRadius: 8, backgroundColor: C.primary, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            Review
          </button>
        </div>
      ))}

      {selected && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, width: 480 }}>
            <h2 style={{ color: C.text, marginBottom: 16 }}>Review Report</h2>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, marginBottom: 14, fontSize: 14 }}>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Analyst notes…" rows={4}
              style={{ width: "100%", padding: "8px 12px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submit} style={{ flex: 1, padding: "9px 0", backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "9px 0", backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
