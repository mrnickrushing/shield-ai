import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { ShieldAPI, Scan } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { colors, radius, spacing } from "@/theme/theme";

export default function History() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["scans"],
    queryFn: ShieldAPI.listScans,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Scan }) => (
    <Pressable
      onPress={() => router.push(`/result?id=${item.id}`)}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", marginBottom: 6 }}>
        {item.scan_type === "link" ? item.raw_input : "Screenshot scan"}
      </Text>
      {item.report ? (
        <RiskBadge level={item.report.risk_level} score={item.report.risk_score} />
      ) : (
        <Text style={{ color: colors.textMuted }}>{item.status}</Text>
      )}
    </Pressable>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={data ?? []}
      keyExtractor={(s) => s.id}
      renderItem={renderItem}
      onRefresh={refetch}
      refreshing={isRefetching}
      ListEmptyComponent={
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.xl }}>
          No scans yet. Check a link or screenshot to get started.
        </Text>
      }
    />
  );
}
