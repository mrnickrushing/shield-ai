import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function Login() {
  const router = useRouter();
  const { login, register, loginWithSocial } = useAuth();
  const [mode, setMode] = useState<"options" | "email_login" | "email_register">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const [googleRequest, googleResponse, promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      redirectUri: AuthSession.makeRedirectUri({ scheme: "shieldai" }),
    },
    { authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth", tokenEndpoint: "https://oauth2.googleapis.com/token" }
  );

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  useEffect(() => {
    if (googleResponse?.type === "success" && googleResponse.authentication?.idToken) {
      handleSocial("google", googleResponse.authentication.idToken);
    }
  }, [googleResponse]);

  const handleSocial = async (provider: "apple" | "google", token: string, emailHint?: string, displayName?: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSocial(provider, token, emailHint, displayName);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? `${provider === "apple" ? "Apple" : "Google"} sign-in failed.`);
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
        setError("Apple Sign In failed. Try again.");
      }
    }
  };

  const submitEmail = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "email_login") await login(email, password);
      else {
        await register(email, password, name);
        await SecureStore.setItemAsync("pendingTour", "true");
      }
      router.replace(mode === "email_register" ? "/paywall" : "/(tabs)/dashboard");
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
    fontSize: 16,
  } as const;

  if (mode !== "options") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}>
          <Pressable onPress={() => setMode("options")} style={{ marginBottom: spacing.xl }}>
            <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginBottom: 4 }}>
            {mode === "email_login" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl }}>
            {mode === "email_login" ? "Sign in to your Shield AI account." : "Protect yourself in under a minute."}
          </Text>
          {mode === "email_register" && (
            <TextInput style={input} placeholder="Display name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
          )}
          <TextInput style={input} placeholder="Email address" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={input} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
          {error && <Text style={{ color: colors.critical, marginBottom: spacing.md }}>{error}</Text>}
          <Pressable onPress={submitEmail} disabled={loading} style={{ backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.lg, alignItems: "center" }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{mode === "email_login" ? "Sign In" : "Create Account"}</Text>}
          </Pressable>
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
      <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDim, alignItems: "center", justifyContent: "center", marginBottom: spacing.md, borderWidth: 2, borderColor: colors.primary + "44" }}>
          <Ionicons name="shield-checkmark" size={40} color={colors.primaryBright} />
        </View>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 }}>Shield AI</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: "center" }}>
          Before you click. Before you pay.{"\n"}Before you trust.
        </Text>
      </View>

      {error && (
        <View style={{ backgroundColor: colors.critical + "22", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ color: colors.critical, textAlign: "center" }}>{error}</Text>
        </View>
      )}

      {loading && <ActivityIndicator color={colors.primaryBright} style={{ marginBottom: spacing.md }} />}

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
        onPress={() => {
          if (!GOOGLE_CLIENT_ID) { setError("Google Sign In requires EXPO_PUBLIC_GOOGLE_CLIENT_ID to be configured."); return; }
          promptGoogleAsync();
        }}
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
      <Pressable
        onPress={() => setMode("email_register")}
        style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.sm }}
      >
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Sign up with Email</Text>
      </Pressable>
      <Pressable
        onPress={() => setMode("email_login")}
        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" }}
      >
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Sign in with Email</Text>
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: spacing.lg }}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}
