import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button, FadeIn, GlowOrb } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

function extractErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string" && first.trim()) return first;
    if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
  }
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

export default function Login() {
  const router = useRouter();
  const { acceptTokens, login, register, loginWithSocial } = useAuth();
  const [mode, setMode] = useState<"options" | "email_login" | "email_register">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const handleSocial = async (provider: "apple" | "google", token: string, emailHint?: string, displayName?: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSocial(provider, token, emailHint?.trim().toLowerCase(), displayName?.trim());
      router.replace("/");
    } catch (e: any) {
      setError(
        extractErrorMessage(
          e,
          `${provider === "apple" ? "Apple" : "Google"} sign-in failed.`
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("No identity token");
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ");
      await handleSocial("apple", cred.identityToken, cred.email ?? undefined, fullName || undefined);
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError(extractErrorMessage(e, "Apple Sign In failed. Try again."));
      }
    }
  };

  const handleGoogle = async () => {
    const returnUrl = Linking.createURL("google-auth");
    setError(null);
    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        ShieldAPI.googleAuthStartUrl(returnUrl),
        returnUrl
      );

      if (result.type !== "success" || !result.url) {
        if (result.type !== "cancel") {
          setError("Google sign-in was cancelled before it completed.");
        }
        return;
      }

      const parsed = Linking.parse(result.url);
      const accessToken = Array.isArray(parsed.queryParams?.access_token)
        ? parsed.queryParams?.access_token[0]
        : parsed.queryParams?.access_token;
      const refreshToken = Array.isArray(parsed.queryParams?.refresh_token)
        ? parsed.queryParams?.refresh_token[0]
        : parsed.queryParams?.refresh_token;
      const authError = Array.isArray(parsed.queryParams?.error)
        ? parsed.queryParams?.error[0]
        : parsed.queryParams?.error;

      if (typeof authError === "string" && authError.trim()) {
        setError(decodeURIComponent(authError));
        return;
      }
      if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
        setError("Google sign-in did not return valid session tokens.");
        return;
      }

      await acceptTokens(accessToken, refreshToken);
      router.replace("/");
    } catch (e: any) {
      setError(extractErrorMessage(e, "Google sign-in failed."));
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!normalizedEmail) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (mode === "email_register" && !trimmedName) {
      setError("Enter your display name.");
      return;
    }
    if (mode === "email_register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    Keyboard.dismiss();
    setError(null);
    setLoading(true);
    try {
      if (mode === "email_login") await login(normalizedEmail, password);
      else {
        await register(normalizedEmail, password, trimmedName);
        await SecureStore.setItemAsync("pendingTour", "true");
      }
      router.replace("/");
    } catch (e: any) {
      setError(extractErrorMessage(e, "Something went wrong. Try again."));
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
    fontSize: 16,
  } as const;

  if (mode !== "options") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setError(null);
              setMode("options");
            }}
            style={{ marginBottom: spacing.xl, alignSelf: "flex-start" }}
            hitSlop={12}
          >
            <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>
            {mode === "email_login" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl }}>
            {mode === "email_login" ? "Sign in to your Shield AI account." : "Protect yourself in under a minute."}
          </Text>
          {mode === "email_register" && (
            <TextInput
              style={input}
              placeholder="Display name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
          )}
          <TextInput
            style={input}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <TextInput
            style={input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textContentType={mode === "email_login" ? "password" : "newPassword"}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submitEmail}
            returnKeyType="go"
          />
          {error && <Text style={{ color: colors.critical, marginBottom: spacing.md }}>{error}</Text>}
          <Button
            label={mode === "email_login" ? "Sign In" : "Create Account"}
            onPress={submitEmail}
            loading={loading}
            style={{ borderRadius: radius.lg }}
          />
          <Pressable onPress={() => setMode(mode === "email_login" ? "email_register" : "email_login")} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.primaryBright, textAlign: "center" }}>
              {mode === "email_login" ? "Need an account? Register" : "Have an account? Sign in"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      {/* Logo */}
      <FadeIn>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={{ alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
            <GlowOrb color={colors.primaryBright} size={180} opacity={0.45} style={{ top: -50, left: -50 }} />
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDim, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: withAlpha(colors.primary, "44") }}>
              <Ionicons name="shield-checkmark" size={40} color={colors.primaryBright} />
            </View>
          </View>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 }}>Shield AI</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: "center" }}>
            Before you click. Before you pay.{"\n"}Before you trust.
          </Text>
        </View>
      </FadeIn>

      {error && (
        <View style={{ backgroundColor: withAlpha(colors.critical, "22"), borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ color: colors.critical, textAlign: "center" }}>{error}</Text>
        </View>
      )}

      {loading && <ActivityIndicator color={colors.primaryBright} style={{ marginBottom: spacing.md }} />}

      <FadeIn delay={80}>
        {/* Apple Sign In */}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={10}
            style={{ width: "100%", height: 52, marginBottom: spacing.md }}
            onPress={handleApple}
          />
        )}

        {/* Google Sign In */}
        <Pressable
          onPress={handleGoogle}
          style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.md }}
        >
          <Ionicons name="logo-google" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Continue with Google</Text>
        </Pressable>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Email options */}
        <Button
          label="Sign up with Email"
          onPress={() => setMode("email_register")}
          style={{ borderRadius: radius.lg, marginBottom: spacing.sm }}
        />
        <Button
          label="Sign in with Email"
          variant="secondary"
          onPress={() => setMode("email_login")}
          style={{ borderRadius: radius.lg }}
        />
      </FadeIn>

      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: spacing.lg }}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
