import React from "react";
import { Text, View } from "react-native";

import { colors } from "@/theme/theme";

export type RiskLevel = "safe" | "low" | "suspicious" | "high" | "critical";

const RISK_COLOR: Record<RiskLevel, string> = {
  safe: colors.safe,
  low: colors.low,
  suspicious: colors.suspicious,
  high: colors.high,
  critical: colors.critical,
};

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: "Looks Safe",
  low: "Low Risk",
  suspicious: "Suspicious",
  high: "High Risk",
  critical: "Critical",
};

export function RiskBadge({ level, score, large }: { level: RiskLevel; score: number; large?: boolean }) {
  const color = RISK_COLOR[level];
  if (large) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 20, backgroundColor: `${color}12`, borderRadius: 16, borderWidth: 1, borderColor: `${color}40`, marginBottom: 8 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, marginBottom: 8 }} />
        <Text style={{ color, fontWeight: "900", fontSize: 28, letterSpacing: -0.5 }}>{RISK_LABEL[level]}</Text>
        <Text style={{ color: `${color}bb`, fontSize: 14, fontWeight: "600", marginTop: 2 }}>Risk score {score}/100</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>
        {RISK_LABEL[level]} · {score}/100
      </Text>
    </View>
  );
}
