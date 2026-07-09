import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { Button, Eyebrow, FadeIn, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { openCallDirectorySettings, syncCallProtection } from "@/lib/callDirectorySync";
import { syncSafariBlocklist } from "@/lib/safariBlocklistSync";
import { colors, spacing, withAlpha } from "@/theme/theme";

const CALL_STEPS = [
  "Open the Settings app",
  "Go to Phone → Call Blocking & Identification",
  "Turn on Shield AI",
];

const TEXT_STEPS = [
  "Open the Settings app",
  "Go to Apps → Messages, or Messages on older iOS versions",
  "Open Unknown & Spam or Message Filtering",
  "Under SMS Filtering, select Shield AI Text Filter",
];

const TEXT_TROUBLESHOOTING = [
  "If Unknown & Spam is missing, install the latest TestFlight build and restart the iPhone.",
  "The option only appears after iOS sees the Shield AI Text Filter extension in the installed app.",
  "Apple only routes texts from unknown senders to filters; saved contacts and conversations you reply to stay in Messages.",
];

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CallProtectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [protectedCount, setProtectedCount] = useState(0);

  const syncMutation = useMutation({
    // One tap refreshes both offline blocklists: scam numbers for the call
    // directory and flagged domains for the Safari extension.
    mutationFn: async (opts?: { silent?: boolean }) => {
      const [calls] = await Promise.all([
        syncCallProtection(),
        syncSafariBlocklist().catch(() => null),
      ]);
      return { ...calls, silent: opts?.silent ?? false };
    },
    onSuccess: async (result) => {
      if (result.synced) {
        setLastSyncedAt(new Date());
        setProtectedCount(result.count);
        if (!result.silent) {
          Alert.alert(
            "Synced",
            result.count > 0
              ? `${result.count} number${result.count === 1 ? "" : "s"} protected.`
              : "Protection is active. The blocklist is still growing — confirmed scam numbers appear automatically."
          );
        }
        // Record that the on-device extensions were provisioned. Both the Call
        // Directory and the SMS filter read the snapshot this sync writes, so a
        // successful sync is the app's signal that call/text protection is
        // active — which is what the protection score credits. Best-effort.
        // Await both writes before invalidating so the score refetch reflects
        // them instead of racing ahead and re-caching the pre-sync score.
        await Promise.allSettled([
          ShieldAPI.recordExtensionEvent({
            extension_type: "call_directory",
            event_type: "synced",
            counts: { numbers: result.count },
          }),
          ShieldAPI.recordExtensionEvent({
            extension_type: "message_filter",
            event_type: "synced",
          }),
        ]);
        queryClient.invalidateQueries({ queryKey: ["protection-score"] });
      }
    },
  });

  useEffect(() => {
    syncMutation.mutate({ silent: true });
    // Sync silently when the screen opens; the manual button confirms with an alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockNumber = () => {
    Alert.prompt(
      "Block a number",
      "Enter the number that called you (find it in your Phone app's Recents). It'll stop ringing your phone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async (value?: string) => {
            const number = (value ?? "").trim();
            if (!number) return;
            try {
              await ShieldAPI.blockNumber(number);
              // Push the new block into the on-device snapshot right away.
              await syncCallProtection();
              Alert.alert("Blocked", "That number won't ring your phone anymore.");
            } catch {
              Alert.alert("Couldn't block", "Check the number and your connection, then try again.");
            }
          },
        },
      ],
      "plain-text",
      "",
      "phone-pad"
    );
  };

  const reportWrongLabel = () => {
    Alert.prompt(
      "Report a wrong label",
      "Enter the phone number that's being labeled incorrectly. We'll review it and remove legitimate numbers from the list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: (value?: string) => {
            const number = (value ?? "").trim();
            if (!number) return;
            ShieldAPI.submitReport({
              report_type: "false_positive",
              artifact_text: number,
              category: "call_label",
            })
              .then(() => Alert.alert("Thanks", "We received your report and will review the label."))
              .catch(() => Alert.alert("Couldn't send", "Check your connection and try again."));
          },
        },
      ],
      "plain-text",
      "",
      "phone-pad"
    );
  };

  const notSupported = Platform.OS !== "ios";
  const syncFailed = syncMutation.isError || (syncMutation.data && !syncMutation.data.synced);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }} hitSlop={12}>
          <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back</Text>
        </Pressable>

        <FadeIn>
          <Surface accent={colors.high} glow={withAlpha(colors.high, "30")} style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: withAlpha(colors.high, "22"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="call-outline" size={22} color={colors.high} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>Call &amp; Text Protection</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Blocks confirmed scam calls and filters scam texts system-wide
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Confirmed scam numbers — and any number you block yourself — never ring your phone.
              Numbers from complaint feeds are labeled &ldquo;Spam Risk&rdquo; on your incoming call
              screen so you can decide, and you can block any of them with one tap below. Texts from
              unknown senders are screened the same way, and scam texts are filed into your Junk
              folder before they ever buzz your phone. No app needs to be open.
            </Text>
          </Surface>
        </FadeIn>

        {notSupported ? (
          <Surface accent={colors.textMuted} style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Call Protection uses Apple&apos;s Call Directory extension and is only available on iOS.
            </Text>
          </Surface>
        ) : (
          <>
            <FadeIn>
              <Surface style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
                  <View>
                    <Eyebrow>Last synced</Eyebrow>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                      {timeAgo(lastSyncedAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Eyebrow>Numbers protected</Eyebrow>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                      {protectedCount}
                    </Text>
                  </View>
                </View>
                {syncFailed ? (
                  <Text style={{ color: colors.suspicious, fontSize: 12, marginBottom: spacing.sm }}>
                    Sync didn&apos;t complete. Check your connection and try again.
                  </Text>
                ) : lastSyncedAt && protectedCount === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
                    Protection is active — the blocklist is still growing. Confirmed scam numbers
                    appear here automatically.
                  </Text>
                ) : null}
                <Button
                  label="Sync Now"
                  icon="refresh-outline"
                  onPress={() => syncMutation.mutate({})}
                  loading={syncMutation.isPending}
                  variant="secondary"
                />
                <Button
                  label="Block a Number"
                  icon="ban-outline"
                  onPress={blockNumber}
                  variant="secondary"
                  style={{ marginTop: spacing.sm }}
                />
                <Pressable onPress={reportWrongLabel} hitSlop={8} style={{ marginTop: spacing.sm }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
                    Is a legitimate number being labeled? <Text style={{ color: colors.primaryBright }}>Report it</Text>
                  </Text>
                </Pressable>
              </Surface>
            </FadeIn>

            <Eyebrow style={{ marginBottom: spacing.sm }}>Finish setup — calls</Eyebrow>
            <Surface style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md }}>
                Apple requires you to turn this on yourself — Shield AI can&apos;t do it for you:
              </Text>
              {CALL_STEPS.map((step, i) => (
                <View key={step} style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: withAlpha(colors.primaryBright, "22"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.primaryBright, fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{step}</Text>
                </View>
              ))}
              <Button
                label="Open Settings"
                icon="settings-outline"
                onPress={() => openCallDirectorySettings()}
                variant="secondary"
                style={{ marginTop: spacing.sm }}
              />
            </Surface>

            <Eyebrow style={{ marginBottom: spacing.sm }}>Finish setup — texts</Eyebrow>
            <Surface style={{ marginBottom: spacing.lg }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.md }}>
                Turn on text filtering the same way. Texts from your saved contacts are never
                touched — Apple only lets filters screen unknown senders:
              </Text>
              {TEXT_STEPS.map((step, i) => (
                <View key={step} style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: withAlpha(colors.teal, "22"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.teal, fontSize: 11, fontWeight: "800" }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{step}</Text>
                </View>
              ))}
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {TEXT_TROUBLESHOOTING.map((tip) => (
                  <View key={tip} style={{ flexDirection: "row", gap: spacing.xs }}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{tip}</Text>
                  </View>
                ))}
              </View>
              <Button
                label="Open Settings"
                icon="settings-outline"
                onPress={() => Linking.openSettings()}
                variant="secondary"
                style={{ marginTop: spacing.sm }}
              />
            </Surface>
          </>
        )}
      </ScrollView>
    </View>
  );
}
