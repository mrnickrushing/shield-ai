import * as AppleAuthentication from "expo-apple-authentication";
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

import { BrandWordmark } from "@/components/BrandWordmark";
import { Button, FadeIn, GlowOrb } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

const NONCE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";

function generateNonce(length = 32) {
  const bytes = new Uint8Array(length);
  const runtimeCrypto = globalThis.crypto as Crypto | undefined;
  if (runtimeCrypto?.getRandomValues) {
    runtimeCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => NONCE_ALPHABET[byte % NONCE_ALPHABET.length]).join("");
}

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(input: string) {
  const bytes = Array.from(input, (char) => char.charCodeAt(0) & 0xff);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i += 1) {
      const j = chunk + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, index) => {
      h[index] = (h[index] + value) >>> 0;
    });
  }

  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function hexToBase64Url(hex: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = Array.from({ length: hex.length / 2 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += alphabet[(chunk >>> 18) & 63];
    output += alphabet[(chunk >>> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(chunk >>> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }
  return output.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

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

  const handleSocial = async (provider: "apple" | "google", token: string, emailHint?: string, displayName?: string, nonce?: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSocial(provider, token, emailHint?.trim().toLowerCase(), displayName?.trim(), nonce);
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
      const rawNonce = generateNonce();
      const hashedNonce = sha256Hex(rawNonce);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!cred.identityToken) throw new Error("No identity token");
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ");
      await handleSocial("apple", cred.identityToken, cred.email ?? undefined, fullName || undefined, rawNonce);
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError(extractErrorMessage(e, "Apple Sign In failed. Try again."));
      }
    }
  };

  const handleGoogle = async () => {
    const returnUrl = ShieldAPI.googleAuthReturnUrl;
    const codeVerifier = generateNonce(64);
    const codeChallenge = hexToBase64Url(sha256Hex(codeVerifier));
    setError(null);
    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        ShieldAPI.googleAuthStartUrl(returnUrl, codeChallenge),
        returnUrl
      );

      if (result.type !== "success" || !result.url) {
        if (result.type !== "cancel") {
          setError("Google sign-in was cancelled before it completed.");
        }
        return;
      }

      const parsed = new URL(result.url);
      const code = parsed.searchParams.get("code");
      const authError = parsed.searchParams.get("error");

      if (typeof authError === "string" && authError.trim()) {
        setError(decodeURIComponent(authError));
        return;
      }
      if (!code) {
        setError("Google sign-in did not return a valid one-time code.");
        return;
      }

      const tokens = await ShieldAPI.googleAuthExchange(code, codeVerifier);
      await acceptTokens(tokens.access_token, tokens.refresh_token);
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
          <BrandWordmark size={40} />
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
