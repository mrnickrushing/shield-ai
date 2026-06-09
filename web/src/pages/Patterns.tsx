import React, { useEffect, useState } from "react";
import { AdminAPI, ScamPattern } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", crit: "#ef4444", safe: "#22c55e" };

const EMPTY: Partial<ScamPattern> = { name: "", description: "", pattern_type: "regex", artifact_types: [], pattern_data: { regex: "", flags: "i" }, risk_score_boost: 0, category: "unknown", source: "analyst" };

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<ScamPattern[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<ScamPattern>>(EMPTY);

  const load = () => AdminAPI.patterns().then(r => setPatterns(r.data));
  useEffect(() => { load(); }, []);

  const toggle = async (p: ScamPattern) => {
    await AdminAPI.updatePattern(p.id, { is_active: !p.is_active });
    load();
  };

  const create = async () => {
    await AdminAPI.createPattern(form);
    setCreating(false);
    setForm(EMPTY);
    load();
  };

  const inp = (style?: object) => ({
    width: "100%", padding: "7px 10px", backgroundColor: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 13, boxSizing: "border-box" as const, ...style,
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Scam Patterns</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Analyst-reviewed patterns applied as threat-intel pre-filter</p>
        </div>
        <button onClick={() => setCreating(true)} style={{ padding: "9px 18px", backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
          + New Pattern
        </button>
      </div>

      {patterns.map(p => (
        <div key={p.id} style={{ backgroundColor: C.surface, border: `1px solid ${p.is_active ? C.border : C.crit + "66"}`, borderRadius: 12, padding: 18, marginBottom: 10, opacity: p.is_active ? 1 : 0.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ color: C.text, fontWeight: 700 }}>{p.name}</span>
                <span style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: "1px 8px", fontSize: 11, color: C.muted }}>{p.pattern_type}</span>
                <span style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, padding: "1px 8px", fontSize: 11, color: C.muted }}>{p.source}</span>
                {p.risk_score_boost > 0 && <span style={{ color: "#f97316", fontSize: 12, fontWeight: 700 }}>+{p.risk_score_boost}</span>}
              </div>
              <p style={{ color: C.muted, fontSize: 13, margin: "0 0 6px" }}>{p.description}</p>
              {p.artifact_types.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.artifact_types.map(a => (
                    <span key={a} style={{ backgroundColor: C.primary + "33", color: C.primary, borderRadius: 999, padding: "1px 8px", fontSize: 11 }}>{a}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => toggle(p)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: p.is_active ? C.crit : C.safe, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, marginLeft: 16, flexShrink: 0 }}>
              {p.is_active ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      ))}

      {creating && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, width: 520, maxHeight: "80vh", overflowY: "auto" }}>
            <h2 style={{ color: C.text, marginBottom: 20 }}>New Scam Pattern</h2>
            {(["name", "description", "category"] as const).map(k => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>{k}</label>
                <input value={(form[k] as string) ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>pattern_type</label>
              <select value={form.pattern_type} onChange={e => setForm(f => ({ ...f, pattern_type: e.target.value }))} style={inp()}>
                <option value="regex">regex</option>
                <option value="keyword">keyword</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>regex (if regex type)</label>
              <input value={(form.pattern_data as any)?.regex ?? ""} onChange={e => setForm(f => ({ ...f, pattern_data: { ...(f.pattern_data as any), regex: e.target.value } }))} style={inp()} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>artifact_types (comma-separated)</label>
              <input value={(form.artifact_types ?? []).join(",")} onChange={e => setForm(f => ({ ...f, artifact_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} style={inp()} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>risk_score_boost (0–100)</label>
              <input type="number" min={0} max={100} value={form.risk_score_boost ?? 0} onChange={e => setForm(f => ({ ...f, risk_score_boost: Number(e.target.value) }))} style={inp({ width: 100 })} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={create} style={{ flex: 1, padding: "9px 0", backgroundColor: C.primary, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Create</button>
              <button onClick={() => setCreating(false)} style={{ flex: 1, padding: "9px 0", backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
