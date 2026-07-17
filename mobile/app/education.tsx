import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Chip, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { QueryErrorState } from "@/components/QueryErrorState";
import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const DIFF_COLOR: Record<string, string> = {
  beginner: colors.safe,
  intermediate: colors.suspicious,
  advanced: colors.critical,
};

const CATEGORIES = [
  { key: undefined,           label: "All" },
  { key: "phishing",          label: "Phishing" },
  { key: "gift_card_scam",    label: "Gift Cards" },
  { key: "romance_scam",      label: "Romance" },
  { key: "account_security",  label: "Accounts" },
  { key: "url_scam",          label: "URLs" },
];

export default function EducationScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data: lessons, isLoading, isError, refetch } = useQuery({
    queryKey: ["lessons", category],
    queryFn: () => ShieldAPI.listLessons(category),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Surface
          accent={colors.safe}
          glow={withAlpha(colors.safe, "30")}
          style={{ marginBottom: spacing.lg, position: "relative" }}
        >
          <GlowOrb color={colors.safe} size={200} opacity={0.28} style={{ top: -60, right: -50 }} />
          <Eyebrow style={{ marginBottom: spacing.sm }}>EDUCATION CENTER</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
            Build pattern recognition.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
            Short lessons to spot scams before they happen.
          </Text>
        </Surface>
      </FadeIn>

      {/* Category filter */}
      <FadeIn delay={60}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg, marginHorizontal: -spacing.lg }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.label}
                label={c.label}
                active={category === c.key}
                onPress={() => setCategory(c.key)}
              />
            ))}
          </View>
        </ScrollView>
      </FadeIn>

      <FadeIn delay={100}>
        {isLoading ? (
          <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
        ) : isError ? (
          <QueryErrorState message="Lessons could not be loaded." onRetry={() => refetch()} />
        ) : (lessons ?? []).length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
            <Ionicons name="book-outline" size={40} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>No lessons here yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>Try a different category or check back soon.</Text>
          </View>
        ) : (
          (lessons ?? []).map((lesson: any) => (
            <Surface
              key={lesson.id}
              onPress={() => router.push(`/lesson?id=${lesson.id}`)}
              accent={lesson.completed ? colors.safe : undefined}
              style={{ marginBottom: spacing.md }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ color: lesson.completed ? colors.safe : colors.text, fontWeight: "700", fontSize: 16, flex: 1, letterSpacing: -0.2 }}>
                  {lesson.completed ? "✓  " : ""}{lesson.title}
                </Text>
                {lesson.quiz_score != null && (
                  <View style={{ backgroundColor: colors.primaryDim, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginLeft: spacing.sm }}>
                    <Text style={{ color: colors.primaryBright, fontSize: 13, fontWeight: "800" }}>{lesson.quiz_score}%</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm, lineHeight: 19 }}>{lesson.summary}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <View style={{ backgroundColor: withAlpha(DIFF_COLOR[lesson.difficulty] ?? colors.textMuted, "22"), borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: DIFF_COLOR[lesson.difficulty] ?? colors.textMuted, fontSize: 11, fontWeight: "700" }}>{(lesson.difficulty ?? "beginner").toUpperCase()}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>~{lesson.estimated_minutes} min</Text>
              </View>
            </Surface>
          ))
        )}
      </FadeIn>
    </ScrollView>
  );
}
