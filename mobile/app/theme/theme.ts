export const colors = {
  // Stitch "Neon Shield" source-of-truth palette.
  bg: "#050A0F",
  bgBloom: "#08243A",
  surface: "#07131F",
  surfaceAlt: "#0A1D29",
  surfaceActive: "#0D2938",
  surfaceHigh: "#102C3B",
  glass: "rgba(10,29,41,0.52)",
  glassActive: "rgba(15,48,64,0.78)",
  glassDeep: "rgba(7,19,31,0.90)",
  border: "#143344",
  borderHi: "#216078",
  text: "#F7FBFF",
  textMuted: "#78909C",
  textDim: "#B6CAD4",
  primary: "#00C8D7",
  primaryBright: "#50D5FF",
  primaryDim: "#00C8D720",
  violet: "#7B61FF",
  accent: "#00E5F0",
  accentDim: "#00E5F018",
  safe: "#45D37B",
  safeDim: "#45D37B18",
  low: "#80D86A",
  lowDim: "#80D86A18",
  suspicious: "#F4B740",
  suspiciousDim: "#F4B74018",
  high: "#F07A45",
  highDim: "#F07A4518",
  critical: "#F04444",
  criticalDim: "#F0444418",
  purple: "#A767E8",
  purpleDim: "#A767E818",
  teal: "#16D7C7",
  tealDim: "#16D7C718",
  rose: "#EF5B72",
  roseDim: "#EF5B7218",
};

export type RiskLevel = "safe" | "low" | "suspicious" | "high" | "critical";

export const riskColors: Record<RiskLevel, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

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
  xxl: 30,
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
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  }),
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

/**
 * Gradient stop arrays for SVG LinearGradient fills. The two-stop pairs are
 * light -> deep; longer runs are used by the hero ring/score/beam treatments.
 */
export const gradients = {
  primary: ["#19E5EC", "#00BFD3"] as const,
  accent: ["#50D5FF", "#00C8D7"] as const,
  safe: [colors.safe, colors.teal] as const,
  warn: [colors.suspicious, colors.high] as const,
  danger: [colors.high, colors.critical] as const,
  purple: [colors.primaryBright, colors.primary] as const,
  dusk: [colors.surfaceHigh, colors.bg] as const,
  score: ["#50D5FF", "#45D37B"] as const,
  ring: ["#45D37B", "#7BE495", "#50D5FF"] as const,
  scanBeam: ["#50D5FF", "#00E5F0"] as const,
  critical: ["#dc2626", "#f87171"] as const,
};

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  lazy: 700,
};

/** Shared text style presets so screens stop redefining the same font rules. */
export const type = {
  eyebrow: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  display: {
    fontSize: 30,
    fontWeight: "900" as const,
    letterSpacing: -1,
    color: colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: -0.4,
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
  },
};

export const mono = {
  fontFamily: "Menlo",
  color: colors.accent,
  letterSpacing: 0.4,
} as const;

export function withAlpha(hex: string, alphaHex: string) {
  return `${hex}${alphaHex}`;
}
