import React from "react";
import { Pressable, Text, View } from "react-native";

import { RiskBadge } from "@/components/RiskBadge";
import { type Scan } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ScanCard({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              marginBottom: 3,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {scan.scan_type === "link" ? "🔗  Link" : "📷  Screenshot"}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", marginBottom: 6 }}>
            {scan.scan_type === "link" ? scan.raw_input : "Screenshot scan"}
          </Text>
          {scan.report ? (
            <RiskBadge level={scan.report.risk_level} score={scan.report.risk_score} />
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{scan.status}</Text>
          )}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(scan.created_at)}</Text>
      </View>
    </Pressable>
  );
}
