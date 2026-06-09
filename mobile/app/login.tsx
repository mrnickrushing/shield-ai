import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

export default function Login() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const input = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800", marginBottom: spacing.xs }}>
        Shield AI
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.xl }}>
        Before you click. Before you pay. Before you trust.
      </Text>

      {mode === "register" && (
        <TextInput
          style={input}
          placeholder="Display name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={{ color: colors.critical, marginBottom: spacing.md }}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={loading}
        style={{
          backgroundColor: colors.primary,
          padding: spacing.md,
          borderRadius: radius.md,
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {mode === "login" ? "Sign In" : "Create Account"}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: spacing.lg }}>
        <Text style={{ color: colors.primaryBright, textAlign: "center" }}>
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}
