import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const DIFF_COLOR: Record<string, string> = { beginner: colors.safe, intermediate: colors.suspicious };

export default function EducationScreen() {
  const router = useRouter();
  const { threat_category } = useLocalSearchParams<{ threat_category?: string }>();
  const { data: lessons, isLoading } = useQuery({ queryKey: ["lessons", threat_category], queryFn: () => ShieldAPI.listLessons(threat_category) });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Education Center</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>Short lessons to help you spot scams before they happen.</Text>
      {isLoading ? <ActivityIndicator color={colors.primaryBright} style={{ marginTop: spacing.xl }} /> : (
        (lessons ?? []).map((lesson: any) => (
          <Pressable key={lesson.id} onPress={() => router.push(`/lesson?id=${lesson.id}`)}
            style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceActive : colors.surface, borderColor: lesson.completed ? colors.safe : colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md })}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <Text style={{ color: lesson.completed ? colors.safe : colors.text, fontWeight: "700", fontSize: 16, flex: 1 }}>{lesson.completed ? "✓ " : ""}{lesson.title}</Text>
              {lesson.quiz_score != null && <Text style={{ color: colors.primaryBright, fontSize: 13, fontWeight: "700" }}>{lesson.quiz_score}%</Text>}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>{lesson.summary}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ backgroundColor: (DIFF_COLOR[lesson.difficulty] ?? colors.textMuted) + "22", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: DIFF_COLOR[lesson.difficulty] ?? colors.textMuted, fontSize: 11, fontWeight: "700" }}>{lesson.difficulty.toUpperCase()}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, alignSelf: "center" }}>~{lesson.estimated_minutes} min</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
