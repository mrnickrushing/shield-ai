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

export function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const color = RISK_COLOR[level];
  return (
    <View
      style={{
        backgroundColor: `${color}22`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
      }}
    >
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }}
      />
      <Text style={{ color, fontWeight: "700" }}>
        {RISK_LABEL[level]} · {score}/100
      </Text>
    </View>
  );
}
