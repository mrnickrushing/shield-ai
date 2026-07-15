import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandWordmark } from "@/components/BrandWordmark";
import { CoachMessage, ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const STARTERS = [
  "I got a text about an unpaid toll — scam?",
  "Someone on Marketplace wants to pay by Zelle",
  "My mom got a call saying I was arrested",
  "A recruiter is offering $400/day for easy tasks",
];

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setInput("");
    const thread = [...messages, { role: "user" as const, content }];
    setMessages(thread);
    setBusy(true);
    try {
      const { reply } = await ShieldAPI.coachChat(thread);
      setMessages([...thread, { role: "assistant", content: reply }]);
    } catch (e: any) {
      if (e?.response?.status === 402) {
        router.push("/paywall" as any);
      } else {
        setError(e?.response?.data?.detail ?? "The coach didn't answer. Try again.");
      }
      // Leave the user's message in the thread so a retry resends it naturally.
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={{ height: insets.top + 56, paddingTop: insets.top, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: `${colors.primaryBright}20` }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={22} color={colors.textDim} /></Pressable>
        <BrandWordmark size={22} />
        <Pressable onPress={() => router.push("/profile")} hitSlop={12}><Ionicons name="person-circle-outline" size={22} color={colors.primaryBright} /></Pressable>
      </View>
      {messages.length === 0 ? (
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: withAlpha(colors.primaryBright, "22"),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: colors.primaryBright, fontSize: 20, fontWeight: "900" }}>AI</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, textAlign: "center" }}>
              Shield AI Assistant Chat
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
              Hello! How can I help with your security today?
            </Text>
          </View>
          {STARTERS.map((s) => (
            <Pressable
              key={s}
              onPress={() => send(s)}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                backgroundColor: item.role === "user" ? colors.surfaceHigh : colors.surface,
                borderWidth: 1,
                borderColor: item.role === "user" ? colors.borderHi : colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.sm,
                maxWidth: "85%",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={
            busy ? (
              <View style={{ alignSelf: "flex-start", padding: spacing.md }}>
                <ActivityIndicator color={colors.primaryBright} size="small" />
              </View>
            ) : null
          }
        />
      )}

      {error && (
        <Text style={{ color: colors.suspicious, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xs }}>
          {error}
        </Text>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <TextInput
          placeholder="Ask about a situation…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            maxHeight: 120,
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim() || busy}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: input.trim() && !busy ? colors.primaryBright : colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-up" size={20} color={input.trim() && !busy ? colors.bg : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
