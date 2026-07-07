import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminAPI, AdminStats, OperationsOverview } from "../api";

const C = { text: "#F8FAFC", muted: "#94A3B8", surface: "#0B1220", bg: "#020617", border: "#1E2A45", bright: "#22D3EE", primary: "#3B82F6", safe: "#22c55e", warn: "#f97316", danger: "#ef4444" };

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 170 }}>
      <div style={{ color: accent ?? C.bright, fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{value.toLocaleString()}</div>
      <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, flex: 1, minWidth: 280 }}><h2 style={{ color: C.text, fontSize: 16, marginTop: 0 }}>{title}</h2>{children}</section>;
}

function Rows({ items }: { items: Record<string, number> }) {
  const entries = Object.entries(items);
  if (!entries.length) return <p style={{ color: C.muted, fontSize: 13 }}>No activity yet.</p>;
  return <>{entries.map(([key, value]) => <div key={key} style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, padding: "9px 0", color: C.muted, fontSize: 13 }}><span>{key.replace(/_/g, " ")}</span><strong style={{ color: C.text }}>{value.toLocaleString()}</strong></div>)}</>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ops, setOps] = useState<OperationsOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    AdminAPI.stats()
      .then(r => setStats(r.data))
      .catch(() => setError("Failed to load stats — check your admin access."));
    AdminAPI.operations()
      .then(r => setOps(r.data))
      .catch(() => setError("Failed to load operations overview."));
  }, []);

  return (
    <div>
      <h1 style={{ color: C.text, fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Operations Dashboard</h1>
      <p style={{ color: C.muted, marginBottom: 24, fontSize: 14 }}>Live admin view for support, trust and safety, subscriptions, alerts, developer access, and review queues.</p>

      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      {stats && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Users" value={stats.total_users} />
            <StatCard label="Active Users" value={stats.active_users} accent={C.safe} />
            <StatCard label="Premium Users" value={stats.premium_users} accent="#facc15" />
            <StatCard label="Developers" value={stats.developer_users} />
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Scans" value={stats.total_scans} />
            <StatCard label="Scans Today" value={stats.scans_today} accent="#22c55e" />
            <StatCard label="High Risk Scans" value={stats.high_risk_scans} accent={stats.high_risk_scans > 0 ? C.warn : C.bright} />
            <StatCard label="High Risk Today" value={stats.high_risk_scans_today} accent={stats.high_risk_scans_today > 0 ? C.danger : C.bright} />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Open Community Reports" value={stats.open_community_reports} accent={stats.open_community_reports > 0 ? "#f97316" : C.bright} />
            <StatCard label="Pending Feedback Reviews" value={stats.pending_feedback_reviews} accent={stats.pending_feedback_reviews > 0 ? "#f97316" : C.bright} />
            <StatCard label="Active Scam Patterns" value={stats.active_scam_patterns} />
            <StatCard label="Open Incidents" value={stats.open_incidents} accent={stats.open_incidents > 0 ? C.warn : C.bright} />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
            <StatCard label="Active API Keys" value={stats.active_api_keys} />
            <StatCard label="Total API Keys" value={stats.total_api_keys} />
            <StatCard label="Revoked API Keys" value={stats.revoked_api_keys} accent={stats.revoked_api_keys > 0 ? "#f97316" : C.bright} />
            <StatCard label="Unread Notifications" value={stats.unread_notifications} accent={stats.unread_notifications > 0 ? C.warn : C.bright} />
            <StatCard label="Monitored Identities" value={stats.monitored_identities} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 24 }}>
            {[
              ["/admin/users", "Investigate users"],
              ["/admin/api-keys", "Manage API keys"],
              ["/admin/notifications", "Debug notifications"],
              ["/admin/subscriptions", "Check subscriptions"],
              ["/admin/feedback", "Review feedback"],
              ["/admin/audit-logs", "Audit admin actions"],
            ].map(([to, label]) => <Link key={to} to={to} style={{ textDecoration: "none", color: C.text, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 13 }}>{label}</Link>)}
          </div>
        </>
      )}

      {ops && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}>
          <Panel title="Today"><Rows items={ops.today} /></Panel>
          <Panel title="Queue Pressure"><Rows items={ops.queues} /></Panel>
          <Panel title="Risk Today"><Rows items={ops.risk_today} /></Panel>
          <Panel title="Threat Categories Today"><Rows items={ops.categories_today} /></Panel>
          <Panel title="Monitoring Telemetry"><Rows items={ops.telemetry} /></Panel>
        </div>
      )}
    </div>
  );
}
