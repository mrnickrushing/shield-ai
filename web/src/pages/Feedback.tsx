import { useEffect, useMemo, useState } from "react";
import { AdminAPI, FeedbackReview } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bg: "#020617", primary: "#3B82F6", safe: "#22c55e", warn: "#f97316", crit: "#ef4444" };

const STATUS_COLORS: Record<string, string> = { pending: C.warn, reviewed: C.primary, promoted: C.safe, rejected: C.crit };

function Badge({ value }: { value: string }) {
  return <span style={{ backgroundColor: STATUS_COLORS[value] ?? C.muted, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{value}</span>;
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackReview[]>([]);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<FeedbackReview | null>(null);
  const [patternName, setPatternName] = useState("");
  const [patternText, setPatternText] = useState("");
  const [error, setError] = useState("");

  const load = () => AdminAPI.feedback(filter || undefined).then(r => setItems(r.data)).catch(() => setError("Failed to load feedback."));
  useEffect(() => { load(); }, [filter]);

  const review = async (id: string, status: string) => {
    try {
      await AdminAPI.reviewFeedback(id, status);
      load();
    } catch {
      setError("Failed to update feedback.");
    }
  };

  const openPromote = (item: FeedbackReview) => {
    setSelected(item);
    setPatternName(`feedback_${item.scan_type}_${item.id.slice(0, 8)}`);
    setPatternText(item.corrected_context || item.evidence || item.raw_input || item.reason);
  };

  const promote = async () => {
    if (!selected || !patternName.trim() || !patternText.trim()) return;
    try {
      await AdminAPI.promoteFeedbackToPattern(selected.id, {
        name: patternName.trim(),
        description: selected.reason || `Promoted from ${selected.feedback} feedback`,
        pattern_type: "keyword",
        artifact_types: [selected.scan_type],
        pattern_data: { keywords: [patternText.trim()] },
        risk_score_boost: selected.feedback === "missed_scam" ? 35 : 15,
        category: selected.threat_category || "analyst_feedback",
        source: "feedback",
      });
      setSelected(null);
      load();
    } catch {
      setError("Failed to promote feedback.");
    }
  };

  const filteredCount = useMemo(() => items.length, [items]);

  return (
    <div>
      {error && <p style={{ color: C.crit, marginBottom: 12, fontSize: 13 }}>{error}</p>}
      <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Feedback Review</h1>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 14 }}>{filteredCount} correction{filteredCount === 1 ? "" : "s"} in this view</p>

      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {["pending", "reviewed", "promoted", "rejected", ""].map(s => (
          <button key={s || "all"} onClick={() => setFilter(s)}
            style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${C.border}`, backgroundColor: filter === s ? C.primary : C.surface, color: filter === s ? "#fff" : C.muted, cursor: "pointer", fontSize: 13 }}>
            {s || "All"}
          </button>
        ))}
      </div>

      {items.length === 0 && <p style={{ color: C.muted }}>No feedback found.</p>}

      {items.map(item => (
        <div key={item.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
            <div>
              <span style={{ color: C.text, fontWeight: 800, marginRight: 10 }}>{item.feedback}</span>
              <Badge value={item.review_status} />
              <span style={{ color: C.muted, fontSize: 12, marginLeft: 10 }}>{item.scan_type} · {item.risk_level || "no report"} · {item.risk_score ?? "n/a"}</span>
            </div>
            <span style={{ color: C.muted, fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</span>
          </div>
          {item.reason && <p style={{ color: C.text, fontSize: 14, margin: "0 0 8px" }}>{item.reason}</p>}
          {(item.corrected_context || item.evidence || item.raw_input) && (
            <div style={{ backgroundColor: C.bg, borderRadius: 8, padding: "10px 12px", color: C.muted, fontSize: 12, fontFamily: "monospace", maxHeight: 140, overflow: "auto", marginBottom: 12, whiteSpace: "pre-wrap" }}>
              {item.corrected_context || item.evidence || item.raw_input}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => review(item.id, "reviewed")} style={{ padding: "6px 12px", borderRadius: 8, border: "none", backgroundColor: C.primary, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark reviewed</button>
            <button onClick={() => review(item.id, "rejected")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reject</button>
            <button onClick={() => openPromote(item)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", backgroundColor: C.safe, color: "#00110a", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Promote to pattern</button>
          </div>
        </div>
      ))}

      {selected && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: 540 }}>
            <h2 style={{ color: C.text, marginTop: 0 }}>Promote Feedback</h2>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Pattern name</label>
            <input value={patternName} onChange={e => setPatternName(e.target.value)} style={{ width: "100%", padding: "8px 10px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, boxSizing: "border-box", marginBottom: 12 }} />
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>Keyword or phrase</label>
            <textarea value={patternText} onChange={e => setPatternText(e.target.value)} rows={5} style={{ width: "100%", padding: "8px 10px", backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, boxSizing: "border-box", resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={promote} style={{ flex: 1, padding: "9px 0", backgroundColor: C.safe, color: "#00110a", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 800 }}>Create pattern</button>
              <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "9px 0", backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
