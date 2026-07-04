import React from "react";
import { Text, View } from "react-native";

import { glow, riskColors, type RiskLevel } from "@/theme/theme";

export type { RiskLevel };

const RISK_LABEL: Record<RiskLevel, string> = {
  safe: "Looks Safe",
  low: "Low Risk",
  suspicious: "Suspicious",
  high: "High Risk",
  critical: "Critical",
};

export function RiskBadge({ level, score, large }: { level: RiskLevel; score: number; large?: boolean }) {
  const color = riskColors[level];
  if (large) {
    return (
      <View
        style={{
          alignItems: "center",
          paddingVertical: 20,
          backgroundColor: `${color}12`,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: `${color}50`,
          marginBottom: 8,
          ...glow(color, "md"),
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: color,
            marginBottom: 8,
            ...glow(color, "sm"),
          }}
        />
        <Text style={{ color, fontWeight: "900", fontSize: 28, letterSpacing: -0.5 }}>{RISK_LABEL[level]}</Text>
        <Text style={{ color: `${color}bb`, fontSize: 14, fontWeight: "600", marginTop: 2 }}>Risk score {score}/100</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: `${color}26`,
        borderColor: `${color}99`,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        ...glow(color, "sm"),
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginRight: 6,
          ...glow(color, "sm"),
        }}
      />
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>
        {RISK_LABEL[level]} · {score}/100
      </Text>
    </View>
  );
}
