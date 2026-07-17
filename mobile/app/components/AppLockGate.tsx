import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Pressable, Text, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { useAuth } from "@/state/auth";
import { colors, radius, spacing } from "@/theme/theme";

const cacheKey = (userId: string) => `requireDeviceUnlockCache:${userId}`;

/**
 * Enforces the "Require device unlock" privacy preference. Without this, the
 * toggle in Settings only persisted a value on the backend — nothing on the
 * client ever asked for Face ID / Touch ID / passcode, so the app opened
 * straight through regardless of the setting.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const appState = useRef(AppState.currentState);
  const [cachedPreference, setCachedPreference] = useState<{ userId: string; required: boolean } | null>(null);
  const [unlockedUserId, setUnlockedUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [obscured, setObscured] = useState(AppState.currentState !== "active");
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let active = true;
    SecureStore.getItemAsync(cacheKey(user.id))
      .then((v) => {
        if (active) setCachedPreference({ userId, required: v === null ? true : v === "true" });
      })
      .catch(() => {
        if (active) setCachedPreference({ userId, required: true });
      });
    return () => { active = false; };
  }, [user?.id]);

  const { data: privacy } = useQuery({
    queryKey: ["privacy-preferences"],
    queryFn: () => ShieldAPI.getPrivacyPreferences(),
    enabled: hydrated && Boolean(user?.id),
  });

  // required starts from the last-known cached value (so a cold launch locks
  // immediately, before the network round-trip resolves) and is replaced by
  // the live server value once it loads.
  const cachedRequired = cachedPreference && cachedPreference.userId === user?.id ? cachedPreference.required : true;
  const required = Boolean(user?.id) && (privacy ? privacy.require_device_unlock : cachedRequired);
  const unlocked = !user?.id || unlockedUserId === user.id;

  useEffect(() => {
    if (privacy && user?.id) SecureStore.setItemAsync(cacheKey(user.id), String(privacy.require_device_unlock)).catch(() => {});
  }, [privacy, user?.id]);

  const attemptUnlock = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        // A protection preference must never silently degrade. Keep protected
        // content locked and offer a safe sign-out escape instead.
        setAuthUnavailable(true);
        setUnlockedUserId(null);
        return;
      }
      setAuthUnavailable(false);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Shield AI",
        disableDeviceFallback: false,
      });
      setUnlockedUserId(result.success ? userId : null);
    } finally {
      setChecking(false);
    }
  }, [user?.id]);

  // Auto-prompt exactly once each time the gate newly becomes locked. Keyed
  // off `required`/`unlocked` only (not `checking`) so a canceled or failed
  // attempt falls back to the manual "Unlock" button instead of the effect
  // immediately re-firing into a retry loop.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!required || unlocked) {
      promptedRef.current = false;
      return;
    }
    if (!promptedRef.current) {
      promptedRef.current = true;
      attemptUnlock();
    }
  }, [required, unlocked, attemptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setObscured(next !== "active");
      if (appState.current.match(/inactive|background/) && next === "active" && required) {
        setUnlockedUserId(null);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [required]);

  // Nothing has mounted yet on this very first render, so a blank frame here
  // costs nothing — but avoids briefly mounting protected screens underneath
  // before we know whether the cached preference says to lock them.
  if (Boolean(user?.id) && !privacy && cachedPreference?.userId !== user?.id) {
    return null;
  }

  const locked = required && !unlocked;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={locked || obscured}
        importantForAccessibility={locked || obscured ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {(locked || obscured) && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.bg,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.md,
          }}
        >
          {!obscured && (
            <>
              <Ionicons name="lock-closed-outline" size={48} color={colors.primaryBright} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Shield AI is locked</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
                {authUnavailable
                  ? "Device authentication is not available. Your protected data will stay locked."
                  : "Unlock with your device passcode or biometrics to continue."}
              </Text>
              {!authUnavailable && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Unlock Shield AI"
                  onPress={attemptUnlock}
                  disabled={checking}
                  style={{ minHeight: 44, justifyContent: "center", backgroundColor: colors.surfaceActive, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{checking ? "Checking..." : "Unlock"}</Text>
                </Pressable>
              )}
              {authUnavailable && (
                <Pressable accessibilityRole="button" onPress={logout} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg }}>
                  <Text style={{ color: colors.suspicious, fontWeight: "800" }}>Sign out safely</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}
