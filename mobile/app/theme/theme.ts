export const colors = {
  bg: "#06060b",
  bgBloom: "#1a1040",
  surface: "#0e0e18",
  surfaceAlt: "#141425",
  surfaceActive: "#15152a",
  surfaceHigh: "#1a1a2e",
  glass: "rgba(255,255,255,0.05)",
  glassActive: "rgba(255,255,255,0.09)",
  glassDeep: "rgba(14,14,24,0.8)",
  border: "#1e1e32",
  borderHi: "#2a2a48",
  text: "#eeeef5",
  textMuted: "#64748b",
  textDim: "#94a3b8",
  primary: "#4f46e5",
  primaryBright: "#818cf8",
  primaryDim: "#4f46e520",
  violet: "#a78bfa",
  accent: "#0ea5e9",
  accentDim: "#0ea5e918",
  safe: "#22c55e",
  safeDim: "#22c55e18",
  low: "#84cc16",
  lowDim: "#84cc1618",
  suspicious: "#f59e0b",
  suspiciousDim: "#f59e0b18",
  high: "#f97316",
  highDim: "#f9731618",
  critical: "#ef4444",
  criticalDim: "#ef444418",
  purple: "#a855f7",
  purpleDim: "#a855f718",
  teal: "#14b8a6",
  tealDim: "#14b8a618",
  rose: "#f43f5e",
  roseDim: "#f43f5e18",
};

export type RiskLevel = "safe" | "low" | "suspicious" | "high" | "critical";

export const riskColors: Record<RiskLevel, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

// Gradient stop arrays consumed by SVG LinearGradient defs.
export const gradients = {
  primary: ["#4f46e5", "#818cf8", "#a78bfa"],
  score: ["#818cf8", "#c084fc"],
  ring: ["#4f46e5", "#818cf8", "#22c55e"],
  scanBeam: ["#0ea5e9", "#818cf8"],
  safe: ["#16a34a", "#4ade80"],
  critical: ["#dc2626", "#f87171"],
};

// iOS shadow glow presets; elevation approximates on Android.
export function glow(color: string, intensity: "sm" | "md" | "lg" = "md") {
  const preset = {
    sm: { radius: 8, opacity: 0.35, elevation: 4 },
    md: { radius: 16, opacity: 0.45, elevation: 8 },
    lg: { radius: 28, opacity: 0.6, elevation: 12 },
  }[intensity];
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: preset.opacity,
    shadowRadius: preset.radius,
    elevation: preset.elevation,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const mono = {
  fontFamily: "Menlo",
  color: colors.accent,
  letterSpacing: 0.4,
} as const;
