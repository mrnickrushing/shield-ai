import React, { useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/theme/theme";

const { width } = Dimensions.get("window");

type Step = {
  emoji: string;
  title: string;
  body: string;
  example: string;
  exampleLabel: string;
};

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Welcome to Shield AI",
    body: "Your personal scam and fraud protection assistant. Before you click, pay, or trust — let's show you how it works.",
    example: "You get a text: \"Your Netflix subscription is expiring — click here to update your payment.\" Shield AI will tell you in seconds if it's real or a phishing scam.",
    exampleLabel: "Real scenario",
  },
  {
    emoji: "🔗",
    title: "Check any link",
    body: "Paste any URL from a text, email, or social post into the Link scanner. You'll get a risk score, red flags, and a plain-English explanation.",
    example: "You receive an email from \"support@paypa1.com\" with a link to verify your account. Paste the URL — Shield AI catches the typo-squatted domain instantly.",
    exampleLabel: "Example",
  },
  {
    emoji: "📸",
    title: "Scan a screenshot",
    body: "Take a screenshot of any suspicious message, email, listing, or post and upload it. The AI reads all the text and flags scam patterns.",
    example: "A Facebook message says you won a prize and need to pay a small shipping fee. Screenshot it and scan — AI spots the classic advance-fee scam.",
    exampleLabel: "Example",
  },
  {
    emoji: "💬",
    title: "Analyze messages & emails",
    body: "Copy suspicious texts or email content directly into the Message or Email scanner for a detailed breakdown.",
    example: "\"Your package is held at customs. Pay $2.49 processing fee at: bit.ly/track9182.\" Paste the text — Shield AI flags the urgency tactics and suspicious link.",
    exampleLabel: "Example",
  },
  {
    emoji: "🛡️",
    title: "Protect tab",
    body: "Set up identity monitoring to get alerted if your email appears in a data breach. Add family members so they're protected too.",
    example: "Your mom gets a call from \"her bank\" asking to confirm her SSN. Add her to Family Protection — she can share scan results directly with you.",
    exampleLabel: "Use case",
  },
  {
    emoji: "📋",
    title: "Your scan history",
    body: "Every scan is saved automatically. Refer back anytime, track your threat history, and share results with family or authorities.",
    example: "You scanned a job offer 3 weeks ago and marked it suspicious. A friend asks about the same company — pull up your history and share the report.",
    exampleLabel: "Use case",
  },
];

type Props = {
  visible: boolean;
  onDone: () => void;
};

export default function AppTour({ visible, onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
      setStep(0);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onDone();
    setStep(0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "flex-end",
      }}>
        {/* Card */}
        <View style={{
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.xl ?? 24,
          borderTopRightRadius: radius.xl ?? 24,
          paddingTop: spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: 48,
          maxHeight: "85%",
        }}>
          {/* Progress dots + skip */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === step ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === step ? colors.primaryBright : colors.border,
                  }}
                />
              ))}
            </View>
            <Pressable onPress={handleSkip} hitSlop={12}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Skip</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Emoji */}
            <Text style={{ fontSize: 52, textAlign: "center", marginBottom: spacing.md }}>{current.emoji}</Text>

            {/* Title */}
            <Text style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: "900",
              letterSpacing: -0.5,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}>
              {current.title}
            </Text>

            {/* Body */}
            <Text style={{
              color: colors.textMuted,
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              marginBottom: spacing.lg,
            }}>
              {current.body}
            </Text>

            {/* Example box */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderLeftWidth: 3,
              borderLeftColor: colors.primaryBright,
              padding: spacing.md,
              marginBottom: spacing.xl,
            }}>
              <Text style={{
                color: colors.primaryBright,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.8,
                marginBottom: spacing.xs,
                textTransform: "uppercase",
              }}>
                {current.exampleLabel}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20, fontStyle: "italic" }}>
                "{current.example}"
              </Text>
            </View>
          </ScrollView>

          {/* CTA */}
          <Pressable
            onPress={handleNext}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              padding: spacing.lg,
              alignItems: "center",
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
              {isLast ? "Let's go →" : "Next"}
            </Text>
          </Pressable>

          {/* Step counter */}
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.sm }}>
            {step + 1} of {STEPS.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
