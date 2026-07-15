import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, RadialGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWordmark } from "@/components/BrandWordmark";
import { GlowBackground } from "@/components/GlowBackground";
import { ShieldAPI, type Scan } from "@/lib/api";
import { syncWidgetSnapshot } from "@/lib/widgetSync";
import { useAuth } from "@/state/auth";
import { colors, glow, radius, spacing } from "@/theme/theme";

const tools: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  secondaryIcon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  { title: "Email Check", subtitle: "Spot phishing & spoofing", icon: "mail-outline", secondaryIcon: "search-outline", route: "/(tabs)/scan?type=email" },
  { title: "Phone Lookup", subtitle: "Verify unknown numbers", icon: "call-outline", secondaryIcon: "globe-outline", route: "/(tabs)/scan?type=phone" },
  { title: "Safe Browser", subtitle: "Browse with a bodyguard", icon: "globe-outline", secondaryIcon: "shield-checkmark-outline", route: "/browser" },
  { title: "QR Check", subtitle: "Preview before opening", icon: "qr-code-outline", secondaryIcon: "qr-code-outline", route: "/(tabs)/scan?type=qr" },
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
  // Only the number lives inside the ring; the label and status sit above and
  // below it, using the full column width, so they can never collide with the
  // arc (which is what clipped "Protection Score" / "Needs attention" before).
  const size = 128;
  const radiusValue = 55;
  const circumference = 2 * Math.PI * radiusValue;
  const arc = circumference * 0.74;
  const filled = arc * Math.max(0, Math.min(1, score / 100));
  const color = score >= 70 ? colors.safe : score >= 45 ? colors.suspicious : colors.critical;
  const status = score >= 70 ? "Protected" : score >= 45 ? "Needs attention" : "At risk";
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, marginBottom: 4 }}>
        Protection Score
      </Text>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
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
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text maxFontSizeMultiplier={1.05} style={{ color: colors.text, fontSize: score >= 100 ? 34 : 40, lineHeight: 44, fontWeight: "900" }}>{score}</Text>
            <Text maxFontSizeMultiplier={1.05} style={{ color: colors.textDim, fontSize: 14, paddingBottom: 5 }}>/100</Text>
          </View>
        </View>
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ color, fontSize: 12, fontWeight: "800", marginTop: 4 }}>
        {status}
      </Text>
    </View>
  );
}

/** Scans over the trailing week, one point per day — real data, not decoration. */
function ActivityTrend({ scans }: { scans: Scan[] | undefined }) {
  const days = 7;
  const counts = new Array<number>(days).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  for (const scan of scans ?? []) {
    const age = Math.floor((startOfToday.getTime() + dayMs - new Date(scan.created_at).getTime()) / dayMs);
    if (age >= 0 && age < days) counts[days - 1 - age] += 1;
  }
  const peak = Math.max(...counts, 1);
  const hasActivity = counts.some((count) => count > 0);
  const w = 170;
  const h = 112;
  const step = (w - 16) / (days - 1);
  const points = counts
    .map((count, i) => `${8 + i * step},${h - 24 - (count / peak) * (h - 52)}`)
    .join(" ");
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="82" viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryBright} stopOpacity="0.38" />
            <Stop offset="1" stopColor={colors.primaryBright} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {hasActivity ? (
          <>
            <Path d={`M${points.replaceAll(" ", " L")} L${8 + (days - 1) * step} ${h - 8} L8 ${h - 8} Z`} fill="url(#trend)" />
            <Polyline
              points={points}
              fill="none"
              stroke={colors.primaryBright}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <Path d="M8 82 H162" fill="none" stroke={colors.borderHi} strokeWidth="1.5" strokeDasharray="4 6" />
        )}
      </Svg>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: -2 }}>
        {hasActivity ? "Scans · last 7 days" : "No scans this week"}
      </Text>
    </View>
  );
}

function PrimaryScanCard() {
  const router = useRouter();
  return (
    <View
      style={{
        minHeight: 142,
        marginBottom: 14,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: `${colors.primaryBright}CC`,
        backgroundColor: "rgba(10,49,67,0.94)",
        padding: 16,
        overflow: "hidden",
        ...glow(colors.primaryBright, "md"),
      }}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(210,247,255,0.68)" }} />
      <View pointerEvents="none" style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: 20,
            backgroundColor: colors.primaryBright,
            alignItems: "center",
            justifyContent: "center",
            ...glow(colors.primaryBright, "sm"),
          }}
        >
          <Ionicons name="scan-outline" size={34} color={colors.bg} />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 15 }}>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.3 }}>Scan something</Text>
          <Text maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 3 }}>
            Check a link, message, screenshot, QR code, or phone number.
          </Text>
          <View
            style={{
              alignSelf: "flex-start",
              minHeight: 36,
              marginTop: 10,
              borderRadius: radius.pill,
              backgroundColor: colors.primaryBright,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ color: colors.bg, fontSize: 13, fontWeight: "900" }}>Start scan</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.bg} />
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/scan")}
        accessibilityRole="button"
        accessibilityLabel="Start a scan"
        accessibilityHint="Check a link, message, screenshot, QR code, or phone number"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </View>
  );
}

function ToolCard({ title, subtitle, icon, secondaryIcon, route }: (typeof tools)[number]) {
  const router = useRouter();
  return (
    <View
      style={{
        width: "48.5%",
        minHeight: 92,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.primaryBright}55`,
        backgroundColor: "rgba(35,51,64,0.62)",
        padding: 11,
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(210,247,255,0.24)" }} />
      <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Ionicons name={icon} size={24} color={colors.primaryBright} />
        <Ionicons name={secondaryIcon} size={20} color={colors.accent} />
      </View>
      <View pointerEvents="none">
        <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{title}</Text>
        <Text numberOfLines={2} maxFontSizeMultiplier={1.1} style={{ color: colors.textDim, fontSize: 11, lineHeight: 14, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={() => router.push(route as any)}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </View>
  );
}

// Suspicious is amber, not the same red as a confirmed threat — and nothing
// here was "Blocked"; scans are verdicts, so say what the verdict was.
const activityMeta: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; verdict: string }> = {
  safe: { icon: "checkmark-circle", color: colors.safe, verdict: "Safe" },
  low: { icon: "checkmark-circle", color: colors.safe, verdict: "Safe" },
  suspicious: { icon: "alert-circle", color: colors.suspicious, verdict: "Caution" },
  high: { icon: "warning", color: colors.critical, verdict: "High risk" },
  critical: { icon: "warning", color: colors.critical, verdict: "High risk" },
};

const SCAN_TYPE_LABEL: Record<string, string> = {
  link: "Link",
  image: "Screenshot",
  qr: "QR code",
  message: "Message",
  email: "Email",
  phone: "Phone number",
  marketplace: "Marketplace",
  social: "Social",
  vertical: "Shield Labs",
  voice: "Voicemail",
};

function timeAgo(dateStr: string): string {
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Human title + detail per scan: domains for links, never raw OCR text or enum names. */
function scanRowText(scan: Scan): { title: string; detail: string } {
  const input = (scan.raw_input || "").trim();
  const type = SCAN_TYPE_LABEL[scan.scan_type] ?? "Scan";
  const when = timeAgo(scan.created_at);
  switch (scan.scan_type) {
    case "link":
    case "qr": {
      const stripped = input.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
      const [domain, ...rest] = stripped.split(/(?=[/?#])/);
      const path = rest.join("");
      return {
        title: domain || `${type} scan`,
        detail: path ? `${path.slice(0, 34)}${path.length > 34 ? "…" : ""} · ${when}` : `${type} · ${when}`,
      };
    }
    case "phone":
      return { title: input || "Phone number scan", detail: `${type} · ${when}` };
    case "message":
    case "marketplace":
    case "social":
      return {
        title: input ? `“${input.slice(0, 48)}${input.length > 48 ? "…" : ""}”` : `${type} scan`,
        detail: `${type} · ${when}`,
      };
    default:
      // Screenshots and documents carry OCR text in raw_input — junk as a title.
      return { title: `${type} scan`, detail: `${type} · ${when}` };
  }
}

function ActivityRow({ scan, isLast }: { scan: Scan; isLast: boolean }) {
  const router = useRouter();
  const level = scan.report?.risk_level ?? "safe";
  const meta = activityMeta[level] ?? activityMeta.safe;
  const { title, detail } = scanRowText(scan);
  return (
    <View
      style={{
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 11,
        paddingVertical: 8,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View pointerEvents="none" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, backgroundColor: `${meta.color}1a`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={meta.icon} size={17} color={meta.color} />
      </View>
      <View pointerEvents="none" style={{ flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{title}</Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{detail}</Text>
      </View>
      <View pointerEvents="none" style={{ flexShrink: 0, backgroundColor: `${meta.color}1a`, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ color: meta.color, fontSize: 11, fontWeight: "800" }}>{meta.verdict}</Text>
      </View>
      <Ionicons pointerEvents="none" name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
      <Pressable
        onPress={() => router.push(`/result?id=${scan.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail}. ${meta.verdict}`}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </View>
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
  const topFix = protection?.fixes?.[0];
  const firstName = user?.display_name?.split(" ")[0] || "";
  // The hero should tell the truth: tie its copy to the actual score.
  const heroStatus =
    score >= 70
      ? "Your digital footprint is low risk."
      : score >= 45
        ? "A few protections still need setup."
        : "Your protection needs attention.";

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <BrandMark size={34} />
          <BrandWordmark size={27} />
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
        <View style={{ minHeight: 88, borderRadius: radius.md, backgroundColor: "rgba(112,151,169,0.20)", borderWidth: 1, borderColor: `${colors.primaryBright}40`, padding: 11, flexDirection: "row", alignItems: "center", ...glow(colors.primaryBright, "sm") }}>
          <BrandMark size={58} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
              {firstName ? `Hello, ${firstName}.` : "Hello."}
            </Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{heroStatus}</Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 13, lineHeight: 18 }}>Monitoring is active.</Text>
          </View>
        </View>

        {/* Score + 7-day trend anchored in one card, not floating loose. */}
        <Pressable
          onPress={() => router.push("/protection" as any)}
          accessibilityRole="button"
          accessibilityLabel={`View protection details. Score ${score} out of 100.`}
          style={{
            marginTop: 14,
            marginBottom: 14,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderColor: `${colors.primaryBright}80`,
            backgroundColor: "rgba(7,25,40,0.97)",
            overflow: "hidden",
            ...glow(colors.primaryBright, "md"),
          }}
        >
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(210,247,255,0.48)" }} />
          <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 7 }}>
            <View style={{ width: "47%", alignItems: "center" }}>
              <RiskGauge score={score} />
            </View>
            <View style={{ width: 1, height: 150, backgroundColor: colors.borderHi }} />
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <ActivityTrend scans={scans} />
              <View
                style={{
                  minHeight: 40,
                  marginTop: 10,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: `${colors.primaryBright}70`,
                  backgroundColor: `${colors.primaryBright}18`,
                  paddingHorizontal: 11,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.primaryBright} />
                <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ color: colors.primaryBright, fontSize: 13, fontWeight: "800" }}>View details</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primaryBright} />
              </View>
            </View>
          </View>
        </Pressable>

        <PrimaryScanCard />

        {topFix && (
          <View
            style={{
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: `${colors.suspicious}40`,
              backgroundColor: colors.glassDeep,
              paddingHorizontal: 11,
              paddingVertical: 8,
            }}
          >
            <Ionicons pointerEvents="none" name="trending-up" size={18} color={colors.suspicious} />
            <View pointerEvents="none" style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                +{topFix.points} to your score
              </Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>{topFix.hint}</Text>
            </View>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ color: colors.suspicious, fontWeight: "800", fontSize: 12 }}>Fix →</Text>
            <Pressable
              onPress={() => router.push(`/${topFix.screen}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`${topFix.hint}. Add ${topFix.points} points to your score.`}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 }}>
          {tools.map((tool) => <ToolCard key={tool.title} {...tool} />)}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 4 }}>
          <Text maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/(tabs)/history")} hitSlop={10}><Text maxFontSizeMultiplier={1.2} style={{ color: colors.primaryBright, fontSize: 13, fontWeight: "800" }}>View all</Text></Pressable>
        </View>
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primaryBright}25`, backgroundColor: colors.glassDeep, overflow: "hidden" }}>
          {recent.length ? recent.map((scan, index) => <ActivityRow key={scan.id} scan={scan} isLast={index === recent.length - 1} />) : (
            <View style={{ paddingVertical: 18, paddingHorizontal: 16, alignItems: "center" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primaryBright}1a`, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Ionicons name="scan-outline" size={20} color={colors.primaryBright} />
              </View>
              <Text maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Your scans will appear here</Text>
              <Text maxFontSizeMultiplier={1.25} style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: "center" }}>
                Your latest checks and verdicts will show up here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
