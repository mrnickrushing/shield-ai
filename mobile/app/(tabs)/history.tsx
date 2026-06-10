import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI, type ScanType } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const TYPE_FILTERS: { value: ScanType | "all"; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "link",        label: "Link" },
  { value: "image",       label: "Screenshot" },
  { value: "qr",          label: "QR" },
  { value: "message",     label: "Message" },
  { value: "email",       label: "Email" },
  { value: "phone",       label: "Phone" },
  { value: "marketplace", label: "Market" },
  { value: "social",      label: "Social" },
];

const RISK_FILTERS: { value: string; label: string; color: string }[] = [
  { value: "all",        label: "Any risk",   color: colors.textMuted },
  { value: "safe",       label: "Safe",       color: colors.safe },
  { value: "low",        label: "Low",        color: colors.low },
  { value: "suspicious", label: "Suspicious", color: colors.suspicious },
  { value: "high",       label: "High",       color: colors.high },
  { value: "critical",   label: "Critical",   color: colors.critical },
];

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  const c = color ?? colors.primaryBright;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: active ? c + "22" : colors.surface,
        borderColor: active ? c : colors.border,
        borderWidth: 1,
      }}
    >
      <Text
        style={{
          color: active ? c : colors.textMuted,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ScanType | "all">("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["scans"],
    queryFn: ShieldAPI.listScans,
  });

  const filtered = useMemo(() => {
    let scans = data ?? [];
    if (typeFilter !== "all") scans = scans.filter((s) => s.scan_type === typeFilter);
    if (riskFilter !== "all") scans = scans.filter((s) => s.report?.risk_level === riskFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      scans = scans.filter(
        (s) => s.raw_input.toLowerCase().includes(q) || s.scan_type.includes(q)
      );
    }
    return scans;
  }, [data, typeFilter, riskFilter, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "900",
            letterSpacing: -0.7,
          }}
        >
          History
        </Text>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search scans…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={{ flex: 1, color: colors.text, paddingVertical: spacing.sm, fontSize: 14 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Type chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TYPE_FILTERS}
        keyExtractor={(f) => f.value}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
          paddingVertical: spacing.sm,
        }}
        renderItem={({ item }) => (
          <Chip
            label={item.label}
            active={typeFilter === item.value}
            onPress={() => setTypeFilter(item.value)}
          />
        )}
        style={{ flexGrow: 0 }}
      />

      {/* Risk chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={RISK_FILTERS}
        keyExtractor={(f) => f.value}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
          paddingBottom: spacing.sm,
        }}
        renderItem={({ item }) => (
          <Chip
            label={item.label}
            active={riskFilter === item.value}
            color={item.color}
            onPress={() => setRiskFilter(item.value)}
          />
        )}
        style={{ flexGrow: 0 }}
      />

      {/* Divider + count */}
      {!isLoading && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xs,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}
          >
            {filtered.length} RESULT{filtered.length !== 1 ? "S" : ""}
          </Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        renderItem={({ item }) => (
          <ScanCard
            scan={item}
            onPress={() => router.push(`/result?id=${item.id}` as any)}
          />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: spacing.xxl }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Ionicons name="time-outline" size={28} color={colors.textMuted} />
            </View>
            <Text
              style={{
                color: colors.textMuted,
                textAlign: "center",
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              {data?.length ? "No scans match your filters." : "No scans yet."}
            </Text>
            {!data?.length && (
              <Text
                style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 4 }}
              >
                Tap Scan to analyze your first suspicious link.
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}
