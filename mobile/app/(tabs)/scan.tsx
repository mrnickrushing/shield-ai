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

import { GlowBackground } from "@/components/GlowBackground";
import { GradientButton } from "@/components/GradientButton";
import { CornerBrackets, ScanBeam } from "@/components/ScanBeam";
import { ShieldAPI } from "@/lib/api";
import { colors, glow as glowStyle, mono, radius, spacing } from "@/theme/theme";

const ANALYSIS_STAGES = [
  "Extracting text...",
  "Checking URLs...",
  "Analyzing brand signals...",
  "Running AI model...",
];

function AnalysisStageText() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStage((s) => (s + 1) % ANALYSIS_STAGES.length), 900);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text style={{ ...mono, fontSize: 13, fontWeight: "600" }}>{ANALYSIS_STAGES[stage]}</Text>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  loading: boolean;
}) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <GradientButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
        icon={icon}
      />
      {loading ? <AnalyzingOverlay /> : null}
    </View>
  );
}

function AnalyzingOverlay({ height = 200 }: { height?: number }) {
  return (
    <View
      style={{
        height,
        borderRadius: radius.lg,
        overflow: "hidden",
        backgroundColor: "rgba(6,6,11,0.75)",
        borderWidth: 1,
        borderColor: `${colors.accent}44`,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        marginTop: spacing.sm,
      }}
    >
      <CornerBrackets color={colors.accent} />
      <ScanBeam height={height} />
      <ActivityIndicator color={colors.primaryBright} size="large" />
      <AnalysisStageText />
    </View>
  );
}

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
    cta: "Analyze Link",
    bestFor: ["Package texts", "Bank alerts", "Password reset links"],
  },
  image: {
    label: "Screenshot",
    title: "Read the screenshot like an analyst",
    subtitle: "Upload a message, fake checkout screen, or suspicious email and let OCR plus scam heuristics do the triage.",
    icon: "image-outline",
    accent: colors.safe,
    cta: "Choose Screenshot",
    bestFor: ["Prize scams", "Fake support chats", "Payment requests"],
  },
  qr: {
    label: "QR",
    title: "Preview a QR destination before it opens",
    subtitle: "QR codes hide the real destination. Scan first, then decide whether it deserves your trust.",
    icon: "scan-outline",
    accent: colors.suspicious,
    cta: "Scan QR Code",
    bestFor: ["Parking meters", "Restaurant tables", "Flyers and posters"],
  },
  message: {
    label: "Message",
    title: "Break down pressure-heavy messages",
    subtitle: "Paste SMS, WhatsApp, Telegram, or iMessage content and we score urgency, impersonation, and payment cues.",
    icon: "chatbubble-ellipses-outline",
    accent: colors.high,
    cta: "Analyze Message",
    bestFor: ["Delivery texts", "Work-from-home offers", "Account warnings"],
  },
  email: {
    label: "Email",
    title: "Spot spoofing and reply-to traps",
    subtitle: "Check the sender, reply-to, subject, and body for the classic phishing mismatches people miss.",
    icon: "mail-open-outline",
    accent: colors.primaryBright,
    cta: "Analyze Email",
    bestFor: ["Brand impersonation", "Invoice scams", "Login prompts"],
  },
  phone: {
    label: "Phone",
    title: "Check whether a number deserves a callback",
    subtitle: "We score spam, suspicious numbering patterns, and scam markers before you dial back or reply.",
    icon: "call-outline",
    accent: colors.critical,
    cta: "Look Up Number",
    bestFor: ["Voicemails", "Unknown callers", "Bank callback requests"],
  },
  marketplace: {
    label: "Marketplace",
    title: "Stress-test a buyer or seller conversation",
    subtitle: "Paste listing text or DMs to catch overpayment, fake escrow, off-platform pressure, and shipping fraud.",
    icon: "storefront-outline",
    accent: colors.low,
    cta: "Analyze Listing",
    bestFor: ["Facebook Marketplace", "Craigslist", "OfferUp deals"],
  },
  social: {
    label: "Social",
    title: "Catch fake giveaways and account bait",
    subtitle: "Run DMs and posts through impersonation, crypto lure, and social takeover patterns before you engage.",
    icon: "people-outline",
    accent: colors.purple,
    cta: "Analyze Post",
    bestFor: ["Influencer giveaways", "Crypto pitches", "Fake account recovery DMs"],
  },
};

function AccentPill({
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
        backgroundColor: active ? `${accent}18` : colors.glass,
        borderColor: active ? `${accent}88` : colors.borderHi,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        justifyContent: "space-between",
        ...(active ? glowStyle(accent) : null),
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: `${accent}22`,
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: colors.textDim,
        fontSize: 11,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontWeight: "700",
      }}
    >
      {children}
    </Text>
  );
}

function ChoicePill({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: active ? accent : colors.surface,
        borderWidth: 1,
        borderColor: active ? accent : colors.border,
      }}
    >
      <Text style={{ color: active ? "#08111f" : colors.textMuted, fontWeight: "700", fontSize: 12 }}>
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
      borderColor: `${active.accent}44`,
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
      setError(e?.response?.data?.detail ?? "Scan failed.");
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
      <GlowBackground accent={`${active.accent}30`} centerY={0.12} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <View
          style={{
            backgroundColor: colors.glassDeep,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: `${active.accent}33`,
            padding: spacing.lg,
            overflow: "hidden",
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: `${active.accent}15`,
              top: -55,
              right: -40,
            }}
          />
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: `${active.accent}1f`,
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
              borderColor: `${active.accent}2a`,
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
                  backgroundColor: `${active.accent}22`,
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
        </View>

        <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm }}>
          PICK AN INPUT
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm, marginBottom: spacing.lg }}>
          {MODE_ORDER.map((value) => {
            const meta = MODE_META[value];
            return (
              <AccentPill
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

        <View
          style={{
            backgroundColor: colors.glassDeep,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: `${active.accent}33`,
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ color: active.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 6 }}>
            BEST FOR
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md }}>
            {active.bestFor.map((tip) => (
              <View
                key={tip}
                style={{
                  backgroundColor: `${active.accent}14`,
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
              <FieldLabel>Suspicious URL</FieldLabel>
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
              <PrimaryButton loading={loading} label={active.cta} onPress={runLink} disabled={!url.trim()} icon="shield-checkmark-outline" />
            </>
          )}

          {mode === "image" && (
            <>
              <Text style={{ color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm }}>
                Upload the screenshot exactly as you received it. Include the sender, warning, or payment request in frame.
              </Text>
              <PrimaryButton loading={loading} label={active.cta} onPress={runImage} icon="images-outline" />
            </>
          )}

          {mode === "qr" && (
            <>
              <Text style={{ color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm }}>
                Hold the code inside the frame. We’ll inspect the hidden destination before you open it.
              </Text>
              {!cameraPermission?.granted ? (
                <PrimaryButton loading={loading} label="Allow Camera Access" onPress={requestCameraPermission} icon="camera-outline" />
              ) : (
                <View style={{ borderRadius: radius.lg, overflow: "hidden", height: 320, marginTop: spacing.sm }}>
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    onBarcodeScanned={loading ? undefined : handleQRScanned}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  />
                  <CornerBrackets color={colors.primaryBright} />
                  {!loading && <ScanBeam height={320} />}
                  {loading && (
                    <View
                      style={{
                        ...StyleSheet_absoluteFill,
                        backgroundColor: "rgba(6,12,24,0.78)",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <ScanBeam height={320} />
                      <ActivityIndicator color={active.accent} size="large" />
                      <AnalysisStageText />
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {mode === "message" && (
            <>
              <FieldLabel>Message Body</FieldLabel>
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
              <FieldLabel>Source</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {["Other", "SMS", "WhatsApp", "iMessage", "Telegram"].map((value) => {
                  const normalized = value === "Other" ? "" : value.toLowerCase();
                  return (
                    <ChoicePill
                      key={value}
                      label={value}
                      active={platformHint === normalized}
                      accent={active.accent}
                      onPress={() => setPlatformHint(normalized)}
                    />
                  );
                })}
              </View>
              <PrimaryButton loading={loading} label={active.cta} onPress={runMessage} disabled={!messageText.trim()} icon="flash-outline" />
            </>
          )}

          {mode === "email" && (
            <>
              <FieldLabel>Sender Address</FieldLabel>
              <TextInput
                placeholder="sender@example.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailSender}
                onChangeText={setEmailSender}
                style={inputStyle}
              />
              <FieldLabel>Display Name</FieldLabel>
              <TextInput
                placeholder="Example: PayPal Support"
                placeholderTextColor={colors.textMuted}
                value={emailDisplayName}
                onChangeText={setEmailDisplayName}
                style={inputStyle}
              />
              <FieldLabel>Reply-To Address</FieldLabel>
              <TextInput
                placeholder="reply@example.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailReplyTo}
                onChangeText={setEmailReplyTo}
                style={inputStyle}
              />
              <FieldLabel>Subject</FieldLabel>
              <TextInput
                placeholder="Subject line"
                placeholderTextColor={colors.textMuted}
                value={emailSubject}
                onChangeText={setEmailSubject}
                style={inputStyle}
              />
              <FieldLabel>Email Body</FieldLabel>
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
              <PrimaryButton
                loading={loading}
                label={active.cta}
                onPress={runEmail}
                disabled={!emailSender.trim() && !emailSubject.trim() && !emailBody.trim()}
                icon="mail-unread-outline"
              />
            </>
          )}

          {mode === "phone" && (
            <>
              <FieldLabel>Phone Number</FieldLabel>
              <TextInput
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                style={inputStyle}
              />
              <PrimaryButton loading={loading} label={active.cta} onPress={runPhone} disabled={!phoneNumber.trim()} icon="call-outline" />
            </>
          )}

          {mode === "marketplace" && (
            <>
              <FieldLabel>Listing Or Chat</FieldLabel>
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
              <FieldLabel>Platform</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {["Other", "Facebook", "eBay", "Craigslist", "OfferUp"].map((value) => {
                  const normalized = value === "Other" ? "" : value.toLowerCase();
                  return (
                    <ChoicePill
                      key={value}
                      label={value}
                      active={marketplacePlatform === normalized}
                      accent={active.accent}
                      onPress={() => setMarketplacePlatform(normalized)}
                    />
                  );
                })}
              </View>
              <PrimaryButton loading={loading} label={active.cta} onPress={runMarketplace} disabled={!marketplaceText.trim()} icon="storefront-outline" />
            </>
          )}

          {mode === "social" && (
            <>
              <FieldLabel>Post Or DM</FieldLabel>
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
              <FieldLabel>Platform</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {["Other", "Instagram", "Facebook", "Twitter", "TikTok", "YouTube"].map((value) => {
                  const normalized = value === "Other" ? "" : value.toLowerCase();
                  return (
                    <ChoicePill
                      key={value}
                      label={value}
                      active={socialPlatform === normalized}
                      accent={active.accent}
                      onPress={() => setSocialPlatform(normalized)}
                    />
                  );
                })}
              </View>
              <PrimaryButton loading={loading} label={active.cta} onPress={runSocial} disabled={!socialText.trim()} icon="sparkles-outline" />
            </>
          )}
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: `${colors.critical}18`,
              borderWidth: 1,
              borderColor: `${colors.critical}44`,
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
