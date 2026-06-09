import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

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
  const { data: lessons, isLoading } = useQuery({
    queryKey: ["lessons", category],
    queryFn: () => ShieldAPI.listLessons(category),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>Education Center</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Short lessons to spot scams before they happen.</Text>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg, marginHorizontal: -spacing.lg }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable key={c.label} onPress={() => setCategory(c.key)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border, borderWidth: 1 }}>
                <Text style={{ color: active ? "#fff" : colors.textMuted, fontWeight: "600", fontSize: 13 }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} />
      ) : (lessons ?? []).length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
          <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📚</Text>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>No lessons here yet</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>Try a different category or check back soon.</Text>
        </View>
      ) : (
        (lessons ?? []).map((lesson: any) => (
          <Pressable key={lesson.id} onPress={() => router.push(`/lesson?id=${lesson.id}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.surfaceActive : colors.surface,
              borderColor: lesson.completed ? colors.safe : colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
            })}
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
              <View style={{ backgroundColor: (DIFF_COLOR[lesson.difficulty] ?? colors.textMuted) + "22", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: DIFF_COLOR[lesson.difficulty] ?? colors.textMuted, fontSize: 11, fontWeight: "700" }}>{(lesson.difficulty ?? "beginner").toUpperCase()}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>~{lesson.estimated_minutes} min</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
