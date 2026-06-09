import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI, type ScanType } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const TYPE_FILTERS: { value: ScanType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "link", label: "Link" },
  { value: "image", label: "Screenshot" },
  { value: "qr", label: "QR" },
  { value: "message", label: "Message" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "marketplace", label: "Market" },
  { value: "social", label: "Social" },
];

const RISK_FILTERS: { value: string; label: string; color: string }[] = [
  { value: "all", label: "Any risk", color: colors.textMuted },
  { value: "safe", label: "Safe", color: colors.safe },
  { value: "low", label: "Low", color: colors.low },
  { value: "suspicious", label: "Suspicious", color: colors.suspicious },
  { value: "high", label: "High", color: colors.high },
  { value: "critical", label: "Critical", color: colors.critical },
];

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  const c = color ?? colors.primary;
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: active ? c : colors.surface, borderColor: active ? c : colors.border, borderWidth: 1 }}>
      <Text style={{ color: active ? "#fff" : (color ?? colors.textMuted), fontWeight: "600", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function History() {
  const router = useRouter();
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
      scans = scans.filter((s) => s.raw_input.toLowerCase().includes(q) || s.scan_type.includes(q));
    }
    return scans;
  }, [data, typeFilter, riskFilter, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search scans…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={{ flex: 1, color: colors.text, paddingVertical: spacing.md, fontSize: 15 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Type chips */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={TYPE_FILTERS} keyExtractor={(f) => f.value}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.xs, paddingVertical: spacing.xs }}
        renderItem={({ item }) => <Chip label={item.label} active={typeFilter === item.value} onPress={() => setTypeFilter(item.value)} />}
        style={{ flexGrow: 0 }}
      />

      {/* Risk chips */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={RISK_FILTERS} keyExtractor={(f) => f.value}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.xs, paddingVertical: spacing.xs }}
        renderItem={({ item }) => <Chip label={item.label} active={riskFilter === item.value} color={item.color} onPress={() => setRiskFilter(item.value)} />}
        style={{ flexGrow: 0, marginBottom: spacing.xs }}
      />

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
        renderItem={({ item }) => <ScanCard scan={item} onPress={() => router.push(`/result?id=${item.id}`)} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              {data?.length ? "No scans match your filters." : "No scans yet. Tap Scan to get started."}
            </Text>
          </View>
        }
      />
    </View>
  );
}
