// Shield AI design tokens — dark, security-focused palette.
export const colors = {
  bg: "#020617",
  surface: "#0B1220",
  surfaceAlt: "#111B30",
  border: "#1E2A45",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  primary: "#3B82F6",
  primaryBright: "#22D3EE",
  // Risk levels
  safe: "#22C55E",
  low: "#84CC16",
  suspicious: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
} as const;

export type RiskLevel = "safe" | "low" | "suspicious" | "high" | "critical";

export const riskColor: Record<RiskLevel, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

export const riskLabel: Record<RiskLevel, string> = {
  safe: "Looks Safe",
  low: "Low Risk",
  suspicious: "Suspicious",
  high: "High Risk",
  critical: "Critical Danger",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
