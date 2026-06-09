import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { RiskBadge } from "@/components/RiskBadge";
import { type Scan } from "@/lib/api";
import { colors, radius, shadow, spacing } from "@/theme/theme";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SCAN_TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  link:        { icon: "link-outline",          label: "Link" },
  image:       { icon: "image-outline",         label: "Screenshot" },
  qr:          { icon: "qr-code-outline",        label: "QR Code" },
  message:     { icon: "chatbubble-outline",     label: "Message" },
  email:       { icon: "mail-outline",           label: "Email" },
  phone:       { icon: "call-outline",           label: "Phone" },
  marketplace: { icon: "storefront-outline",     label: "Marketplace" },
  social:      { icon: "people-outline",         label: "Social" },
};

export function ScanCard({ scan, onPress }: { scan: Scan; onPress: () => void }) {
  const meta = SCAN_TYPE_META[scan.scan_type] ?? { icon: "scan-outline" as keyof typeof Ionicons.glyphMap, label: scan.scan_type };
  const showInput = scan.scan_type === "link" || scan.scan_type === "qr" || scan.scan_type === "phone";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceActive : colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...shadow.sm,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", flex: 1, marginRight: spacing.sm, alignItems: "flex-start", gap: spacing.sm }}>
          <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.primaryDim, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
            <Ionicons name={meta.icon} size={17} color={colors.primaryBright} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textDim, fontSize: 11, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {meta.label}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", marginBottom: 6 }}>
              {showInput ? scan.raw_input : `${meta.label} scan`}
            </Text>
            {scan.report ? (
              <RiskBadge level={scan.report.risk_level} score={scan.report.risk_score} />
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{scan.status}</Text>
            )}
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(scan.created_at)}</Text>
      </View>
    </Pressable>
  );
}
