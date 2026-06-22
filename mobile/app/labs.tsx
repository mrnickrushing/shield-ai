import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, shadow, spacing } from "@/theme/theme";

export default function Labs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => ShieldAPI.listVerticals(),
    staleTime: 300_000,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
      >
        <Text style={{ color: colors.primaryBright, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm }}>
          SHIELD LABS
        </Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1, marginBottom: 6 }}>
          One engine. Many guards.
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg }}>
          Experimental decision assistants built on the same evidence-first engine as Shield. Each one answers a single
          high-stakes question. Tap to try.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primaryBright} size="large" style={{ marginTop: spacing.xl }} />
        ) : isError || !data ? (
          <Text style={{ color: colors.textMuted, marginTop: spacing.lg }}>
            Couldn&apos;t load the labs catalog. Pull back and try again.
          </Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {data.map((v) => (
              <Pressable
                key={v.key}
                onPress={() => router.push(`/vertical/${v.key}` as any)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.surfaceActive : colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: `${v.accent}33`,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  ...shadow.sm,
                })}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    backgroundColor: `${v.accent}22`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={v.icon as keyof typeof Ionicons.glyphMap} size={24} color={v.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 2 }}>{v.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{v.tagline}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
