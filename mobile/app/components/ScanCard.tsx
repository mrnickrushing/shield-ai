import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { RiskBadge } from "@/components/RiskBadge";
import { type Scan } from "@/lib/api";
import { colors, glow, radius, spacing } from "@/theme/theme";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SCAN_TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = {
  link:        { icon: "link-outline",       label: "Link",        color: colors.primaryBright },
  image:       { icon: "image-outline",      label: "Screenshot",  color: colors.teal },
  qr:          { icon: "qr-code-outline",    label: "QR Code",     color: colors.rose },
  message:     { icon: "chatbubble-outline", label: "Message",     color: colors.safe },
  email:       { icon: "mail-outline",       label: "Email",       color: colors.accent },
  phone:       { icon: "call-outline",       label: "Phone",       color: colors.suspicious },
  marketplace: { icon: "storefront-outline", label: "Marketplace", color: colors.low },
  social:      { icon: "people-outline",     label: "Social",      color: colors.purple },
  vertical:    { icon: "flask-outline",      label: "Shield Labs", color: colors.primaryBright },
};

const RISK_COLOR: Record<string, string> = {
  safe:       colors.safe,
  low:        colors.low,
  suspicious: colors.suspicious,
  high:       colors.high,
  critical:   colors.critical,
};

export function ScanCard({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  const meta = SCAN_TYPE_META[scan.scan_type] ?? {
    icon: "scan-outline" as keyof typeof Ionicons.glyphMap,
    label: scan.scan_type,
    color: colors.primaryBright,
  };
  const showInput = ["link", "qr", "phone", "vertical"].includes(scan.scan_type);
  const riskLevel = scan.report?.risk_level;
  const accentColor = riskLevel ? (RISK_COLOR[riskLevel] ?? meta.color) : meta.color;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.glassActive : colors.glassDeep,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `${accentColor}30`,
        marginBottom: spacing.sm,
        flexDirection: "row",
        overflow: "hidden",
      })}
    >
      {/* Left accent bar with glow */}
      <View style={{ width: 3, backgroundColor: accentColor, borderRadius: 2, ...glow(accentColor, "sm") }} />

      <View style={{ flex: 1, padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
        {/* Icon */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: meta.color + "20",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          <Ionicons name={meta.icon} size={17} color={meta.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <Text
              style={{
                color: colors.textDim,
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              {meta.label}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(scan.created_at)}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", fontSize: 14, marginBottom: 6 }}>
            {showInput ? scan.raw_input : `${meta.label} scan`}
          </Text>
          {scan.report ? (
            <RiskBadge level={scan.report.risk_level} score={scan.report.risk_score} />
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{scan.status}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
