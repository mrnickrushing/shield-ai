import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const { data: lesson, isLoading } = useQuery({ queryKey: ["lesson", id], queryFn: () => ShieldAPI.getLesson(id) });
  const complete = useMutation({
    mutationFn: () => ShieldAPI.completeLesson(id, { answers }),
    onSuccess: (data: any) => { setScore(data.quiz_score); setSubmitted(true); qc.invalidateQueries({ queryKey: ["lessons"] }); },
  });

  if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}><ActivityIndicator color={colors.primaryBright} /></View>;
  if (!lesson) return null;

  const lsn = lesson as any;
  const paragraphs = (lsn.content as string).split("\n").filter(Boolean);
  const questions: any[] = lsn.quiz_questions ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>{lsn.difficulty?.toUpperCase()}</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, alignSelf: "center" }}>~{lsn.estimated_minutes} min</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", marginBottom: spacing.lg }}>{lsn.title}</Text>
      {paragraphs.map((p: string, i: number) => {
        if (p.startsWith("## ")) return <Text key={i} style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm }}>{p.slice(3)}</Text>;
        if (p.startsWith("### ")) return <Text key={i} style={{ color: colors.primaryBright, fontSize: 15, fontWeight: "700", marginTop: spacing.md, marginBottom: 4 }}>{p.slice(4)}</Text>;
        if (p.startsWith("- ") || p.startsWith("* ")) return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginLeft: spacing.md }}>• {p.slice(2)}</Text>;
        if (/^\d+\.\s/.test(p)) return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginLeft: spacing.md }}>{p}</Text>;
        return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 4 }}>{p}</Text>;
      })}
      {questions.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.md }}>Quick Check</Text>
          {questions.map((q: any, qi: number) => (
            <View key={qi} style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm, lineHeight: 22 }}>{qi + 1}. {q.question}</Text>
              {q.options.map((opt: string, oi: number) => {
                const selected = answers[qi] === oi;
                const correct = submitted && oi === q.answer_index;
                const wrong = submitted && selected && oi !== q.answer_index;
                return (
                  <Pressable key={oi} onPress={() => { if (!submitted) { const next = [...answers]; next[qi] = oi; setAnswers(next); } }}
                    style={{ backgroundColor: correct ? "#0f2a18" : wrong ? "#2a0f0f" : selected ? colors.surfaceActive : colors.surface, borderColor: correct ? colors.safe : wrong ? colors.critical : selected ? colors.primary : colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                    <Text style={{ color: correct ? colors.safe : wrong ? colors.critical : selected ? colors.text : colors.textMuted, fontSize: 14 }}>{correct ? "✓ " : wrong ? "✗ " : ""}{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {!submitted ? (
            <Pressable onPress={() => complete.mutate()} disabled={answers.length < questions.length}
              style={{ backgroundColor: answers.length >= questions.length ? colors.primary : colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Submit Answers</Text>
            </Pressable>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: "900" }}>{score ?? "–"}%</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>{score === 100 ? "Perfect! 🎉" : score !== null && score >= 50 ? "Good work. Review the content above." : "Keep studying — you've got this."}</Text>
              <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}><Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back to lessons</Text></Pressable>
            </View>
          )}
        </View>
      )}
      {questions.length === 0 && (
        <Pressable onPress={() => complete.mutate()} style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Mark as Complete ✓</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
