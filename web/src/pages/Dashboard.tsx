import { useEffect, useState } from "react";
import { AdminAPI, AdminStats } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", border: "#1E2A45", bright: "#22D3EE", primary: "#3B82F6" };

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", flex: 1 }}>
      <div style={{ color: accent ?? C.bright, fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{value.toLocaleString()}</div>
      <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    AdminAPI.stats()
      .then(r => setStats(r.data))
      .catch(() => setError("Failed to load stats — check your admin access."));
  }, []);

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: C.muted, marginBottom: 32, fontSize: 14 }}>Platform overview</p>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      {stats && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Users" value={stats.total_users} />
            <StatCard label="Total Scans" value={stats.total_scans} />
            <StatCard label="Scans Today" value={stats.scans_today} accent="#22c55e" />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Open Community Reports" value={stats.open_community_reports} accent={stats.open_community_reports > 0 ? "#f97316" : C.bright} />
            <StatCard label="Active Scam Patterns" value={stats.active_scam_patterns} />
            <StatCard label="Active API Keys" value={stats.active_api_keys} />
          </div>
        </>
      )}
    </div>
  );
}
