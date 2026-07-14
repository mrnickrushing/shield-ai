import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, RadialGradient, Stop } from "react-native-svg";
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

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        ...glow(colors.primaryBright, size > 40 ? "md" : "sm"),
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <RadialGradient id={`brand-core-${size}`} cx="50%" cy="46%" r="58%">
            <Stop offset="0" stopColor="#D7F8FF" stopOpacity="0.94" />
            <Stop offset="0.36" stopColor={colors.primaryBright} stopOpacity="0.75" />
            <Stop offset="1" stopColor="#087E9A" stopOpacity="0.16" />
          </RadialGradient>
        </Defs>
        <Circle cx="32" cy="32" r="30" fill={colors.primaryBright} fillOpacity="0.08" stroke={colors.primaryBright} strokeOpacity="0.34" />
        <Circle cx="32" cy="32" r="24" fill="none" stroke={colors.primaryBright} strokeOpacity="0.28" strokeWidth="2" />
        <Circle cx="32" cy="32" r="19" fill={`url(#brand-core-${size})`} />
        <Path
          d="M32 18.5 43 23v8.2c0 7.2-4.5 12.6-11 15.1-6.5-2.5-11-7.9-11-15.1V23l11-4.5Z"
          fill="#073245"
          fillOpacity="0.82"
          stroke="#B9F4FF"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <Path d="m26.6 31.9 3.6 3.7 7.5-8" fill="none" stroke="#B9F4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="32" cy="3.5" r="2.1" fill={colors.primaryBright} />
        <Circle cx="60.5" cy="32" r="1.7" fill={colors.primaryBright} fillOpacity="0.78" />
      </Svg>
    </View>
  );
}

function RiskGauge({ score }: { score: number }) {
  const size = 138;
  const radiusValue = 52;
  const circumference = 2 * Math.PI * radiusValue;
  const arc = circumference * 0.74;
  const filled = arc * Math.max(0, Math.min(1, score / 100));
  const color = score >= 70 ? colors.safe : score >= 45 ? colors.suspicious : colors.critical;
  return (
    <View style={{ width: size, height: 126, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", top: 0 }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          fill="none"
          stroke={colors.border}
          strokeWidth={9}
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
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(137 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", marginTop: 8 }}>
        <Text style={{ color: colors.textDim, fontSize: 10 }}>Risk Score</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ color: colors.text, fontSize: 33, lineHeight: 37, fontWeight: "900" }}>{score}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, paddingBottom: 3 }}>/100</Text>
        </View>
        <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
          {score >= 70 ? "Low Risk" : score >= 45 ? "Review Needed" : "High Risk"}
        </Text>
      </View>
    </View>
  );
}

function RiskTrend() {
  return (
    <Svg width="100%" height="106" viewBox="0 0 170 112">
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
        height: 82,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.primaryBright}${pressed ? "dd" : "88"}`,
        backgroundColor: pressed ? colors.glassActive : colors.glassDeep,
        padding: 11,
        justifyContent: "space-between",
        ...glow(colors.primaryBright, pressed ? "md" : "sm"),
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ionicons name={icon} size={24} color={colors.primaryBright} />
        <Ionicons name="search-outline" size={17} color={colors.accent} />
      </View>
      <View>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 9, marginTop: 1 }}>{subtitle}</Text>
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
        paddingVertical: 8,
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
      <View style={{ paddingTop: insets.top + 4, height: insets.top + 48, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ width: 34 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <BrandMark size={28} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.35 }}>Shield AI</Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={{ width: 34, alignItems: "flex-end" }}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primaryBright} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ minHeight: 80, borderRadius: radius.md, backgroundColor: "rgba(170,211,230,0.25)", borderWidth: 1, borderColor: `${colors.primaryBright}66`, padding: 10, flexDirection: "row", alignItems: "center", ...glow(colors.primaryBright, "md") }}>
          <BrandMark size={58} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>Hello, {firstName}.</Text>
            <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 11, marginTop: 1 }}>Your digital footprint is low risk.</Text>
            <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 11 }}>AI is monitoring actively.</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 4 }}>
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

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/(tabs)/history")}><Text style={{ color: colors.primaryBright, fontSize: 11, fontWeight: "700" }}>View all</Text></Pressable>
        </View>
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primaryBright}25`, backgroundColor: colors.glassDeep, overflow: "hidden" }}>
          {recent.length ? recent.map((scan) => <ActivityRow key={scan.id} scan={scan} />) : (
            <Pressable onPress={() => router.push("/(tabs)/scan")} style={{ padding: 14, alignItems: "center" }}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>No scans yet</Text>
              <Text style={{ color: colors.primaryBright, fontSize: 12, fontWeight: "800", marginTop: 4 }}>Run your first scan</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
