import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

import { Button, Chip, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, gradients, radius, spacing, withAlpha } from "@/theme/theme";

type ScanMode =
  | "link"
  | "image"
  | "qr"
  | "message"
  | "email"
  | "phone"
  | "marketplace"
  | "social";

type ModeMeta = {
  label: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  gradient: readonly [string, string];
  cta: string;
  bestFor: string[];
};

const MODE_ORDER: ScanMode[] = [
  "link",
  "image",
  "qr",
  "message",
  "email",
  "phone",
  "marketplace",
  "social",
];

const MODE_META: Record<ScanMode, ModeMeta> = {
  link: {
    label: "Link",
    title: "Preflight a link before you open it",
    subtitle: "We check domain age, redirects, impersonation patterns, and known threat signals before you click.",
    icon: "link-outline",
    accent: colors.primaryBright,
    gradient: gradients.primary,
    cta: "Analyze Link",
    bestFor: ["Package texts", "Bank alerts", "Password reset links"],
  },
  image: {
    label: "Screenshot",
    title: "Read the screenshot like an analyst",
    subtitle: "Upload a message, fake checkout screen, or suspicious email and let OCR plus scam heuristics do the triage.",
    icon: "image-outline",
    accent: colors.safe,
    gradient: gradients.safe,
    cta: "Choose Screenshot",
    bestFor: ["Prize scams", "Fake support chats", "Payment requests"],
  },
  qr: {
    label: "QR",
    title: "Preview a QR destination before it opens",
    subtitle: "QR codes hide the real destination. Scan first, then decide whether it deserves your trust.",
    icon: "scan-outline",
    accent: colors.suspicious,
    gradient: gradients.warn,
    cta: "Scan QR Code",
    bestFor: ["Parking meters", "Restaurant tables", "Flyers and posters"],
  },
  message: {
    label: "Message",
    title: "Break down pressure-heavy messages",
    subtitle: "Paste SMS, WhatsApp, Telegram, or iMessage content and we score urgency, impersonation, and payment cues.",
    icon: "chatbubble-ellipses-outline",
    accent: colors.high,
    gradient: gradients.warn,
    cta: "Analyze Message",
    bestFor: ["Delivery texts", "Work-from-home offers", "Account warnings"],
  },
  email: {
    label: "Email",
    title: "Spot spoofing and reply-to traps",
    subtitle: "Check the sender, reply-to, subject, and body for the classic phishing mismatches people miss.",
    icon: "mail-open-outline",
    accent: colors.primaryBright,
    gradient: gradients.primary,
    cta: "Analyze Email",
    bestFor: ["Brand impersonation", "Invoice scams", "Login prompts"],
  },
  phone: {
    label: "Phone",
    title: "Check whether a number deserves a callback",
    subtitle: "We score spam, suspicious numbering patterns, and scam markers before you dial back or reply.",
    icon: "call-outline",
    accent: colors.critical,
    gradient: gradients.danger,
    cta: "Look Up Number",
    bestFor: ["Voicemails", "Unknown callers", "Bank callback requests"],
  },
  marketplace: {
    label: "Marketplace",
    title: "Stress-test a buyer or seller conversation",
    subtitle: "Paste listing text or DMs to catch overpayment, fake escrow, off-platform pressure, and shipping fraud.",
    icon: "storefront-outline",
    accent: colors.low,
    gradient: [colors.low, colors.safe],
    cta: "Analyze Listing",
    bestFor: ["Facebook Marketplace", "Craigslist", "OfferUp deals"],
  },
  social: {
    label: "Social",
    title: "Catch fake giveaways and account bait",
    subtitle: "Run DMs and posts through impersonation, crypto lure, and social takeover patterns before you engage.",
    icon: "people-outline",
    accent: colors.purple,
    gradient: gradients.purple,
    cta: "Analyze Post",
    bestFor: ["Influencer giveaways", "Crypto pitches", "Fake account recovery DMs"],
  },
};

function ModePill({
  label,
  active,
  accent,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "48%",
        minHeight: 90,
        backgroundColor: active ? withAlpha(accent, "18") : colors.surface,
        borderColor: active ? withAlpha(accent, "88") : colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: withAlpha(accent, "22"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: "700", fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [mode, setMode] = useState<ScanMode>((params.type as ScanMode) ?? "link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrScanned = useRef(false);

  const [url, setUrl] = useState("");
  const [messageText, setMessageText] = useState("");
  const [platformHint, setPlatformHint] = useState("");
  const [emailSender, setEmailSender] = useState("");
  const [emailDisplayName, setEmailDisplayName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [marketplaceText, setMarketplaceText] = useState("");
  const [marketplacePlatform, setMarketplacePlatform] = useState("");
  const [socialText, setSocialText] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (params.type) setMode(params.type as ScanMode);
  }, [params.type]);

  const active = MODE_META[mode];

  const inputStyle = useMemo(
    () => ({
      backgroundColor: colors.bg,
      borderColor: withAlpha(active.accent, "44"),
      borderWidth: 1,
      borderRadius: radius.md,
      color: colors.text,
      padding: spacing.md,
      marginBottom: spacing.sm,
    }),
    [active.accent]
  );

  const multilineStyle = {
    ...inputStyle,
    minHeight: 120,
    textAlignVertical: "top" as const,
  };

  const navigate = (scan: { id: string }) => router.push(`/result?id=${scan.id}`);

  const wrap = async (fn: () => Promise<{ id: string }>) => {
    setError(null);
    setLoading(true);
    try {
      navigate(await fn());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pasteText = async (setter: (text: string) => void) => {
    const text = await Clipboard.getStringAsync();
    if (text) setter(text.trim());
  };

  const runLink = () => wrap(() => ShieldAPI.scanLink(url.trim()));

  const runImage = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    setLoading(true);
    try {
      navigate(await ShieldAPI.scanImage(res.assets[0].base64));
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          (e?.code === "ECONNABORTED" ? "Scan timed out — please try again." : "Scan failed.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanned = ({ data }: { data: string }) => {
    if (qrScanned.current || loading) return;
    qrScanned.current = true;
    wrap(() => ShieldAPI.scanQR(data)).finally(() => {
      qrScanned.current = false;
    });
  };

  const runMessage = () => wrap(() => ShieldAPI.scanMessage(messageText.trim(), platformHint || undefined));
  const runEmail = () =>
    wrap(() =>
      ShieldAPI.scanEmail({
        sender_email: emailSender.trim() || undefined,
        sender_display_name: emailDisplayName.trim() || undefined,
        reply_to_email: emailReplyTo.trim() || undefined,
        subject: emailSubject.trim() || undefined,
        body_text: emailBody.trim() || undefined,
      })
    );
  const runPhone = () => wrap(() => ShieldAPI.scanPhone(phoneNumber.trim()));
  const runMarketplace = () =>
    wrap(() =>
      ShieldAPI.scanMarketplace(marketplaceText.trim(), marketplacePlatform || undefined)
    );
  const runSocial = () =>
    wrap(() => ShieldAPI.scanSocial(socialText.trim(), socialPlatform || undefined));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <FadeIn>
          <Surface accent={active.accent} style={{ marginBottom: spacing.lg, position: "relative" }}>
            <GlowOrb color={active.accent} size={220} opacity={0.3} style={{ top: -70, right: -50 }} />
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: withAlpha(active.accent, "1f"),
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: active.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
                THREAT LAB
              </Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -1, marginBottom: 8 }}>
              Analyze anything before you act.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg }}>
              Start with the suspicious artifact you actually have. We’ll turn it into a verdict, evidence, and a next move.
            </Text>
            <View
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: withAlpha(active.accent, "2a"),
                borderRadius: radius.lg,
                padding: spacing.md,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: withAlpha(active.accent, "22"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={active.icon} size={18} color={active.accent} />
                </View>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
                  {active.title}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                {active.subtitle}
              </Text>
            </View>
          </Surface>
        </FadeIn>

        <FadeIn delay={60}>
          <Eyebrow style={{ marginBottom: spacing.sm }}>PICK AN INPUT</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm, marginBottom: spacing.lg }}>
            {MODE_ORDER.map((value) => {
              const meta = MODE_META[value];
              return (
                <ModePill
                  key={value}
                  label={meta.label}
                  active={mode === value}
                  accent={meta.accent}
                  icon={meta.icon}
                  onPress={() => {
                    setMode(value);
                    setError(null);
                  }}
                />
              );
            })}
          </View>
        </FadeIn>

        <FadeIn delay={100}>
          <Surface accent={active.accent} style={{ marginBottom: spacing.md }}>
            <Eyebrow color={active.accent} style={{ marginBottom: 6 }}>BEST FOR</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md }}>
              {active.bestFor.map((tip) => (
                <View
                  key={tip}
                  style={{
                    backgroundColor: withAlpha(active.accent, "14"),
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{tip}</Text>
                </View>
              ))}
            </View>

            {mode === "link" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Suspicious URL</Eyebrow>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
                  <TextInput
                    placeholder="https://..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="url"
                    value={url}
                    onChangeText={setUrl}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  />
                  <Pressable
                    onPress={() => pasteText(setUrl)}
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: active.accent, fontWeight: "800", fontSize: 13 }}>Paste</Text>
                  </Pressable>
                </View>
                <Button label={active.cta} onPress={runLink} disabled={!url.trim()} loading={loading} icon="shield-checkmark-outline" gradient={active.gradient} style={{ marginTop: spacing.sm }} />
              </>
            )}

            {mode === "image" && (
              <>
                <Text style={{ color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm }}>
                  Upload the screenshot exactly as you received it. Include the sender, warning, or payment request in frame.
                </Text>
                <Button label={active.cta} onPress={runImage} loading={loading} icon="images-outline" gradient={active.gradient} style={{ marginTop: spacing.sm }} />
              </>
            )}

            {mode === "qr" && (
              <>
                <Text style={{ color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm }}>
                  Hold the code inside the frame. We’ll inspect the hidden destination before you open it.
                </Text>
                {!cameraPermission?.granted ? (
                  <Button label="Allow Camera Access" onPress={requestCameraPermission} icon="camera-outline" gradient={active.gradient} style={{ marginTop: spacing.sm }} />
                ) : (
                  <View style={{ borderRadius: radius.lg, overflow: "hidden", height: 320, marginTop: spacing.sm }}>
                    <CameraView
                      style={{ flex: 1 }}
                      facing="back"
                      onBarcodeScanned={loading ? undefined : handleQRScanned}
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    />
                    <View
                      style={{
                        ...StyleSheet_absoluteFill,
                        borderWidth: 2,
                        borderColor: withAlpha(active.accent, "66"),
                      }}
                      pointerEvents="none"
                    />
                    {loading && (
                      <View
                        style={{
                          ...StyleSheet_absoluteFill,
                          backgroundColor: "rgba(6,12,24,0.78)",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <ActivityIndicator color={active.accent} size="large" />
                        <Text style={{ color: colors.text, marginTop: spacing.sm, fontWeight: "700" }}>
                          Analyzing QR destination...
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {mode === "message" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Message Body</Eyebrow>
                <TextInput
                  placeholder="Paste the message here..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={messageText}
                  onChangeText={setMessageText}
                  style={multilineStyle}
                />
                <Pressable onPress={() => pasteText(setMessageText)} style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
                  <Text style={{ color: active.accent, fontSize: 13, fontWeight: "800" }}>Paste from clipboard</Text>
                </Pressable>
                <Eyebrow style={{ marginBottom: 6 }}>Source</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                  {["Other", "SMS", "WhatsApp", "iMessage", "Telegram"].map((value) => {
                    const normalized = value === "Other" ? "" : value.toLowerCase();
                    return (
                      <Chip
                        key={value}
                        label={value}
                        active={platformHint === normalized}
                        color={active.accent}
                        onPress={() => setPlatformHint(normalized)}
                      />
                    );
                  })}
                </View>
                <Button label={active.cta} onPress={runMessage} disabled={!messageText.trim()} loading={loading} icon="flash-outline" gradient={active.gradient} />
              </>
            )}

            {mode === "email" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Sender Address</Eyebrow>
                <TextInput
                  placeholder="sender@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={emailSender}
                  onChangeText={setEmailSender}
                  style={inputStyle}
                />
                <Eyebrow style={{ marginBottom: 6 }}>Display Name</Eyebrow>
                <TextInput
                  placeholder="Example: PayPal Support"
                  placeholderTextColor={colors.textMuted}
                  value={emailDisplayName}
                  onChangeText={setEmailDisplayName}
                  style={inputStyle}
                />
                <Eyebrow style={{ marginBottom: 6 }}>Reply-To Address</Eyebrow>
                <TextInput
                  placeholder="reply@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={emailReplyTo}
                  onChangeText={setEmailReplyTo}
                  style={inputStyle}
                />
                <Eyebrow style={{ marginBottom: 6 }}>Subject</Eyebrow>
                <TextInput
                  placeholder="Subject line"
                  placeholderTextColor={colors.textMuted}
                  value={emailSubject}
                  onChangeText={setEmailSubject}
                  style={inputStyle}
                />
                <Eyebrow style={{ marginBottom: 6 }}>Email Body</Eyebrow>
                <TextInput
                  placeholder="Paste the email body here..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={emailBody}
                  onChangeText={setEmailBody}
                  style={multilineStyle}
                />
                <Pressable onPress={() => pasteText(setEmailBody)} style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
                  <Text style={{ color: active.accent, fontSize: 13, fontWeight: "800" }}>Paste body from clipboard</Text>
                </Pressable>
                <Button
                  label={active.cta}
                  onPress={runEmail}
                  disabled={!emailSender.trim() && !emailSubject.trim() && !emailBody.trim()}
                  loading={loading}
                  icon="mail-unread-outline"
                  gradient={active.gradient}
                />
              </>
            )}

            {mode === "phone" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Phone Number</Eyebrow>
                <TextInput
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  style={inputStyle}
                />
                <Button label={active.cta} onPress={runPhone} disabled={!phoneNumber.trim()} loading={loading} icon="call-outline" gradient={active.gradient} />
              </>
            )}

            {mode === "marketplace" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Listing Or Chat</Eyebrow>
                <TextInput
                  placeholder="Paste the listing or buyer/seller exchange..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={marketplaceText}
                  onChangeText={setMarketplaceText}
                  style={multilineStyle}
                />
                <Pressable onPress={() => pasteText(setMarketplaceText)} style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
                  <Text style={{ color: active.accent, fontSize: 13, fontWeight: "800" }}>Paste from clipboard</Text>
                </Pressable>
                <Eyebrow style={{ marginBottom: 6 }}>Platform</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                  {["Other", "Facebook", "eBay", "Craigslist", "OfferUp"].map((value) => {
                    const normalized = value === "Other" ? "" : value.toLowerCase();
                    return (
                      <Chip
                        key={value}
                        label={value}
                        active={marketplacePlatform === normalized}
                        color={active.accent}
                        onPress={() => setMarketplacePlatform(normalized)}
                      />
                    );
                  })}
                </View>
                <Button label={active.cta} onPress={runMarketplace} disabled={!marketplaceText.trim()} loading={loading} icon="storefront-outline" gradient={active.gradient} />
              </>
            )}

            {mode === "social" && (
              <>
                <Eyebrow style={{ marginBottom: 6 }}>Post Or DM</Eyebrow>
                <TextInput
                  placeholder="Paste the post, comment, or DM..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={socialText}
                  onChangeText={setSocialText}
                  style={multilineStyle}
                />
                <Pressable onPress={() => pasteText(setSocialText)} style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
                  <Text style={{ color: active.accent, fontSize: 13, fontWeight: "800" }}>Paste from clipboard</Text>
                </Pressable>
                <Eyebrow style={{ marginBottom: 6 }}>Platform</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                  {["Other", "Instagram", "Facebook", "Twitter", "TikTok", "YouTube"].map((value) => {
                    const normalized = value === "Other" ? "" : value.toLowerCase();
                    return (
                      <Chip
                        key={value}
                        label={value}
                        active={socialPlatform === normalized}
                        color={active.accent}
                        onPress={() => setSocialPlatform(normalized)}
                      />
                    );
                  })}
                </View>
                <Button label={active.cta} onPress={runSocial} disabled={!socialText.trim()} loading={loading} icon="sparkles-outline" gradient={active.gradient} />
              </>
            )}
          </Surface>
        </FadeIn>

        {error ? (
          <View
            style={{
              backgroundColor: withAlpha(colors.critical, "18"),
              borderWidth: 1,
              borderColor: withAlpha(colors.critical, "44"),
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.critical, fontWeight: "700" }}>{error}</Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 4 }}>
            What happens next
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
            Every scan returns a verdict, why we reached it, and the next safest move. High-risk results can jump straight into recovery guidance.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const StyleSheet_absoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
