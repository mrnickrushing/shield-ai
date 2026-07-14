import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowBackground } from "@/components/GlowBackground";
import { ShieldAPI, type Scan } from "@/lib/api";
import { syncWidgetSnapshot } from "@/lib/widgetSync";
import { useAuth } from "@/state/auth";
import { colors, glow, radius, spacing } from "@/theme/theme";

const tools: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  { title: "Email Analyzer", subtitle: "Check for breaches", icon: "mail-outline", route: "/(tabs)/scan?type=email" },
  { title: "Phone Lookup", subtitle: "Verify numbers", icon: "call-outline", route: "/(tabs)/scan?type=phone" },
  { title: "Web Scanner", subtitle: "Browse safely", icon: "globe-outline", route: "/browser" },
  { title: "QR Check", subtitle: "Scan securely", icon: "qr-code-outline", route: "/(tabs)/scan?type=qr" },
];

function RiskGauge({ score }: { score: number }) {
  const size = 144;
  const radiusValue = 54;
  const circumference = 2 * Math.PI * radiusValue;
  const arc = circumference * 0.74;
  const filled = arc * Math.max(0, Math.min(1, score / 100));
  const color = score >= 70 ? colors.safe : score >= 45 ? colors.suspicious : colors.critical;
  return (
    <View style={{ width: size, height: 132, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", top: 0 }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          fill="none"
          stroke={colors.border}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          transform={`rotate(137 ${size / 2} ${size / 2})`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(137 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", marginTop: 9 }}>
        <Text style={{ color: colors.textDim, fontSize: 11 }}>Risk Score</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: "900" }}>{score}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, paddingBottom: 3 }}>/100</Text>
        </View>
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>
          {score >= 70 ? "Low Risk" : score >= 45 ? "Review Needed" : "High Risk"}
        </Text>
      </View>
    </View>
  );
}

function RiskTrend() {
  return (
    <Svg width="100%" height="112" viewBox="0 0 170 112">
      <Defs>
        <LinearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primaryBright} stopOpacity="0.38" />
          <Stop offset="1" stopColor={colors.primaryBright} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path
        d="M4 92 L22 78 L38 84 L54 56 L70 70 L86 18 L101 72 L118 57 L134 61 L153 41 L166 36 L166 108 L4 108 Z"
        fill="url(#trend)"
      />
      <Polyline
        points="4,92 22,78 38,84 54,56 70,70 86,18 101,72 118,57 134,61 153,41 166,36"
        fill="none"
        stroke={colors.primaryBright}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ToolCard({ title, subtitle, icon, route }: (typeof tools)[number]) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(route as any)}
      style={({ pressed }) => ({
        width: "48.5%",
        minHeight: 96,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.primaryBright}${pressed ? "dd" : "88"}`,
        backgroundColor: pressed ? colors.glassActive : colors.glassDeep,
        padding: 13,
        justifyContent: "space-between",
        ...glow(colors.primaryBright, pressed ? "md" : "sm"),
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ionicons name={icon} size={27} color={colors.primaryBright} />
        <Ionicons name="search-outline" size={18} color={colors.accent} />
      </View>
      <View>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const activityMeta: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  safe: { icon: "checkmark-circle", color: colors.safe },
  low: { icon: "checkmark-circle", color: colors.safe },
  suspicious: { icon: "alert-circle", color: colors.critical },
  high: { icon: "alert-circle", color: colors.critical },
  critical: { icon: "alert-circle", color: colors.critical },
};

function ActivityRow({ scan }: { scan: Scan }) {
  const router = useRouter();
  const level = scan.report?.risk_level ?? "safe";
  const meta = activityMeta[level] ?? activityMeta.safe;
  const verdict = ["safe", "low"].includes(level) ? "Safe" : "Blocked";
  const label = scan.raw_input || `${scan.scan_type} scan`;
  return (
    <Pressable
      onPress={() => router.push(`/result?id=${scan.id}` as any)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.glass : "transparent",
      })}
    >
      <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: `${meta.color}1a`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={meta.icon} size={17} color={meta.color} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>{scan.scan_type.replaceAll("_", " ")}</Text>
      </View>
      <Text style={{ color: meta.color, fontSize: 11, fontWeight: "700" }}>{verdict}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 7 }} />
    </Pressable>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((state) => state.user);
  const { data: scans } = useQuery({ queryKey: ["scans"], queryFn: ShieldAPI.listScans, staleTime: 30_000 });
  const { data: protection } = useQuery({ queryKey: ["protection-score"], queryFn: ShieldAPI.protectionScore, staleTime: 300_000 });
  const threatsBlocked = scans?.filter((scan) => scan.report && ["suspicious", "high", "critical"].includes(scan.report.risk_level)).length ?? 0;
  const score = protection?.score ?? (scans?.length ? Math.max(42, Math.round(100 - (threatsBlocked / scans.length) * 58)) : 85);
  const recent = scans?.slice(0, 3) ?? [];
  const firstName = user?.display_name?.split(" ")[0] || "Alex";

  useEffect(() => {
    if (!scans) return;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    syncWidgetSnapshot({
      scansThisWeek: scans.filter((scan) => new Date(scan.created_at).getTime() >= weekAgo).length,
      threatsBlocked,
      callsProtected: scans.filter((scan) => scan.scan_type === "phone" && scan.report && ["high", "critical"].includes(scan.report.risk_level)).length,
    });
  }, [scans, threatsBlocked]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GlowBackground accent={colors.bgBloom} centerY={0.15} />
      <View style={{ paddingTop: insets.top + 7, height: insets.top + 53, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 34 }} />
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Shield AI v2</Text>
        <Pressable onPress={() => router.push("/notifications")} hitSlop={12} style={{ width: 34, alignItems: "flex-end" }}>
          <Ionicons name="notifications-outline" size={22} color={colors.primaryBright} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ borderRadius: radius.md, backgroundColor: "rgba(170,211,230,0.25)", borderWidth: 1, borderColor: `${colors.primaryBright}66`, padding: 14, flexDirection: "row", alignItems: "center", ...glow(colors.primaryBright, "md") }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primaryBright, alignItems: "center", justifyContent: "center", ...glow(colors.primaryBright, "md") }}>
            <Text style={{ color: colors.primaryBright, fontSize: 22, fontWeight: "900" }}>AI</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Hello, {firstName}.</Text>
            <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>Your digital footprint is low risk.</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>AI is monitoring actively.</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 11, marginBottom: 7 }}>
          <Pressable
            onPress={() => router.push("/protection" as any)}
            accessibilityRole="button"
            accessibilityLabel="View protection checklist"
            style={{ width: "46%", alignItems: "center" }}
          >
            <RiskGauge score={score} />
          </Pressable>
          <View style={{ flex: 1 }}><RiskTrend /></View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
          {tools.map((tool) => <ToolCard key={tool.title} {...tool} />)}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/(tabs)/history")}><Text style={{ color: colors.primaryBright, fontSize: 11, fontWeight: "700" }}>View all</Text></Pressable>
        </View>
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primaryBright}25`, backgroundColor: colors.glassDeep, overflow: "hidden" }}>
          {recent.length ? recent.map((scan) => <ActivityRow key={scan.id} scan={scan} />) : (
            <Pressable onPress={() => router.push("/(tabs)/scan")} style={{ padding: 18, alignItems: "center" }}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>No scans yet</Text>
              <Text style={{ color: colors.primaryBright, fontSize: 12, fontWeight: "800", marginTop: 4 }}>Run your first scan</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
