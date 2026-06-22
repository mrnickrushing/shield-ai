import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
        <FadeIn>
          <Surface style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: spacing.md }}>📭</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18, marginBottom: 8 }}>Lesson not found</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: spacing.xl }}>
              This lesson may have been removed or the link is invalid.
            </Text>
            <Button label="Back to lessons" icon="arrow-back-outline" onPress={() => router.back()} />
          </Surface>
        </FadeIn>
      </View>
    );
  }

  const lsn = lesson as any;
  const paragraphs = (lsn.content as string).split("\n").filter(Boolean);
  const questions: any[] = lsn.quiz_questions ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Surface accent={colors.primaryBright} glow={withAlpha(colors.primary, "30")} style={{ marginBottom: spacing.lg, position: "relative" }}>
          <GlowOrb color={colors.primaryBright} size={200} opacity={0.28} style={{ top: -60, right: -50 }} />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, alignItems: "center" }}>
            <View style={{ backgroundColor: withAlpha(colors.primaryBright, "1f"), borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
              <Text style={{ color: colors.primaryBright, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }}>
                {lsn.difficulty?.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>~{lsn.estimated_minutes} min</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 }}>{lsn.title}</Text>
        </Surface>
      </FadeIn>

      <FadeIn delay={60}>
        <Surface style={{ marginBottom: spacing.lg }}>
          {paragraphs.map((p: string, i: number) => {
            if (p.startsWith("## ")) return <Text key={i} style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginTop: i === 0 ? 0 : spacing.lg, marginBottom: spacing.sm }}>{p.slice(3)}</Text>;
            if (p.startsWith("### ")) return <Text key={i} style={{ color: colors.primaryBright, fontSize: 15, fontWeight: "700", marginTop: spacing.md, marginBottom: 4 }}>{p.slice(4)}</Text>;
            if (p.startsWith("- ") || p.startsWith("* ")) return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginLeft: spacing.md }}>• {p.slice(2)}</Text>;
            if (/^\d+\.\s/.test(p)) return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginLeft: spacing.md }}>{p}</Text>;
            return <Text key={i} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 4 }}>{p}</Text>;
          })}
        </Surface>
      </FadeIn>

      {questions.length > 0 && (
        <FadeIn delay={100}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>QUICK CHECK</Eyebrow>
          {questions.map((q: any, qi: number) => (
            <Surface key={qi} style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm, lineHeight: 22 }}>{qi + 1}. {q.question}</Text>
              {q.options.map((opt: string, oi: number) => {
                const selected = answers[qi] === oi;
                const correct = submitted && oi === q.answer_index;
                const wrong = submitted && selected && oi !== q.answer_index;
                return (
                  <Pressable
                    key={oi}
                    onPress={() => { if (!submitted) { const next = [...answers]; next[qi] = oi; setAnswers(next); } }}
                    style={{
                      backgroundColor: correct ? withAlpha(colors.safe, "1f") : wrong ? withAlpha(colors.critical, "1f") : selected ? colors.surfaceActive : colors.surface,
                      borderColor: correct ? colors.safe : wrong ? colors.critical : selected ? colors.primary : colors.border,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text style={{ color: correct ? colors.safe : wrong ? colors.critical : selected ? colors.text : colors.textMuted, fontSize: 14 }}>
                      {correct ? "✓ " : wrong ? "✗ " : ""}{opt}
                    </Text>
                  </Pressable>
                );
              })}
            </Surface>
          ))}
          {!submitted ? (
            <Button
              label="Submit Answers"
              onPress={() => complete.mutate()}
              disabled={answers.length < questions.length}
              loading={complete.isPending}
              style={{ marginBottom: spacing.lg }}
            />
          ) : (
            <FadeIn>
              <Surface style={{ alignItems: "center", marginBottom: spacing.lg }}>
                <Text style={{ color: colors.text, fontSize: 32, fontWeight: "900" }}>{score ?? "–"}%</Text>
                <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: "center" }}>
                  {score === 100 ? "Perfect! 🎉" : score !== null && score >= 50 ? "Good work. Review the content above." : "Keep studying — you've got this."}
                </Text>
                <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
                  <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back to lessons</Text>
                </Pressable>
              </Surface>
            </FadeIn>
          )}
        </FadeIn>
      )}

      {questions.length === 0 && (
        <FadeIn delay={100}>
          <Button
            label="Mark as Complete"
            icon="checkmark-circle-outline"
            onPress={() => complete.mutate()}
            loading={complete.isPending}
            style={{ marginTop: spacing.sm }}
          />
        </FadeIn>
      )}
    </ScrollView>
  );
}
