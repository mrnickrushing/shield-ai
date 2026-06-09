import React from "react";
import { Text, View } from "react-native";

import { RiskLevel, radius, riskColor, riskLabel } from "@/theme/theme";

export function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const color = riskColor[level];
  return (
    <View
      style={{
        backgroundColor: `${color}22`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: radius.pill,
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
        {riskLabel[level]} · {score}/100
      </Text>
    </View>
  );
}
