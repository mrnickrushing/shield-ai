import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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

import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowBackground } from "@/components/GlowBackground";
import { GradientButton } from "@/components/GradientButton";
import { PressableFX } from "@/components/PressableFX";
import { CornerBrackets, ScanBeam } from "@/components/ScanBeam";
import { ScanCard } from "@/components/ScanCard";
import { ShieldAPI } from "@/lib/api";
import { colors, glow as glowStyle, mono, radius, spacing } from "@/theme/theme";

const ANALYSIS_STAGES = [
  "Extracting text...",
  "Checking URLs...",
  "Analyzing brand signals...",
  "Running AI model...",
];

type DetectedKind = "link" | "phone" | "message";

function detectInputKind(text: string): DetectedKind {
  const t = text.trim();
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return "link";
  if (!/\s/.test(t) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t)) return "link";
  const digits = t.replace(/\D/g, "");
  if (/^[\d\s()+.-]+$/.test(t) && digits.length >= 7 && digits.length <= 15) return "phone";
  return "message";
}

function normalizeUrl(text: string) {
  const t = text.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

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
  | "voice"
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
  "voice",
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
  voice: {
    label: "Voicemail",
    title: "Play a voicemail — we listen for the script",
    subtitle: "Hold your phone near the speaker (or read it aloud). Transcription happens on your device, then we score IRS threats, callback pressure, and voice-clone family-emergency patterns.",
    icon: "mic-outline",
    accent: colors.teal,
    cta: "Analyze Voicemail",
    bestFor: ["IRS & SSA threats", "Grandparent scams", "Fake fraud departments"],
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
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; text?: string }>();
  const [mode, setMode] = useState<ScanMode>((params.type as ScanMode) ?? "link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Siri/Shortcuts entry point: shieldai://scan?text=... pre-fills the
  // universal box (e.g. a "Check with Shield AI" shortcut passing the clipboard).
  const [universalText, setUniversalText] = useState(params.text ? decodeURIComponent(params.text) : "");
  const [advancedOpen, setAdvancedOpen] = useState(!!params.type);
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
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceCaller, setVoiceCaller] = useState("");
  const [listening, setListening] = useState(false);
  const [marketplaceText, setMarketplaceText] = useState("");
  const [marketplacePlatform, setMarketplacePlatform] = useState("");
  const [socialText, setSocialText] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { data: recentScans } = useQuery({
    queryKey: ["scans"],
    queryFn: ShieldAPI.listScans,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (params.type) {
      setMode(params.type as ScanMode);
      setAdvancedOpen(true);
    }
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

  // On-device voicemail transcription: audio never leaves the phone, only
  // the resulting text is sent for analysis.
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript ?? "";
    if (text) setVoiceTranscript(text);
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (event.error !== "aborted") {
      setError("Transcription stopped — you can also type or paste the voicemail text.");
    }
  });

  const startListening = async () => {
    setError(null);
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      setError("Microphone access is needed to transcribe a voicemail. You can also type it below.");
      return;
    }
    setVoiceTranscript("");
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      // Voicemail played from another device is far-field audio; keep iOS
      // from ducking or filtering it as background noise.
      iosCategory: { category: "playAndRecord", categoryOptions: ["defaultToSpeaker"], mode: "measurement" },
    });
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  };

  const runVoice = () => {
    if (listening) stopListening();
    return wrap(() => ShieldAPI.scanVoice(voiceTranscript.trim(), voiceCaller.trim() || undefined));
  };

  const handleScanError = (e: any, fallback: string) => {
    if (e?.response?.status === 402) {
      router.push("/paywall" as any);
      return;
    }
    setError(e?.response?.data?.detail ?? fallback);
  };

  const wrap = async (fn: () => Promise<{ id: string }>) => {
    setError(null);
    setLoading(true);
    try {
      navigate(await fn());
    } catch (e: any) {
      handleScanError(e, "Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pasteText = async (setter: (text: string) => void) => {
    const text = await Clipboard.getStringAsync();
    if (text) setter(text.trim());
  };

  const runLink = () => wrap(() => ShieldAPI.scanLink(url.trim()));

  const runUniversal = () => {
    const kind = detectInputKind(universalText);
    if (kind === "link") return wrap(() => ShieldAPI.scanLink(normalizeUrl(universalText)));
    if (kind === "phone") return wrap(() => ShieldAPI.scanPhone(universalText.trim()));
    return wrap(() => ShieldAPI.scanMessage(universalText.trim(), undefined));
  };

  const runImage = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    setLoading(true);
    try {
      navigate(await ShieldAPI.scanImage(res.assets[0].base64));
    } catch (e: any) {
      handleScanError(e, "Scan failed.");
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
      <GlowBackground accent={`${colors.primary}30`} centerY={0.12} />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.xl,
        }}
      >
        {/* Only reached by push (e.g. Protect's Marketplace/Social lanes) carries
            a type param — the tab bar itself never does, so this never shadows it. */}
        {!!params.type && (
          <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }} hitSlop={12}>
            <Text style={{ color: colors.primaryBright, fontSize: 15 }}>← Back</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 32 }}>
            <Ionicons name="chevron-back" size={23} color={colors.textDim} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Shield AI Multi-Scanner</Text>
          <Pressable onPress={() => router.push("/profile")} hitSlop={12} style={{ width: 32, alignItems: "flex-end" }}>
            <Ionicons name="person-circle-outline" size={23} color={colors.textDim} />
          </Pressable>
        </View>

        {/* Stitch scanner viewfinder */}
        <View style={{ height: 214, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#02070B", marginBottom: 10 }}>
          <View style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: `${colors.primaryBright}16` }} />
          <View style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: `${colors.primaryBright}16` }} />
          <CornerBrackets color={colors.accent} />
          <ScanBeam height={214} />
          <Pressable
            onPress={runImage}
            style={{
              position: "absolute", left: "50%", top: "50%", marginLeft: -28, marginTop: -28,
              width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.accent}22`,
              borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center",
              ...glowStyle(colors.accent, "md"),
            }}
          >
            <Ionicons name="camera-outline" size={28} color={colors.accent} />
          </Pressable>
          <View style={{ position: "absolute", left: 0, right: 0, top: "50%", marginTop: -62, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Scan QR Code or Mail</Text>
          </View>
        </View>

        <View style={{ backgroundColor: colors.glassDeep, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primaryBright}5f`, padding: 9, marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: `${colors.primaryBright}77`, padding: 2, marginBottom: 10 }}>
            {(["link", "image", "message"] as ScanMode[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  if (item === "image") runImage();
                  else setMode(item);
                }}
                style={{ flex: 1, height: 27, borderRadius: radius.pill, backgroundColor: mode === item ? colors.accent : "transparent", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: mode === item ? colors.bg : colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, borderRadius: 9, borderWidth: 1, borderColor: colors.accent, minHeight: mode === "message" ? 72 : 42, paddingHorizontal: 10, marginBottom: 9, ...glowStyle(colors.accent, "sm") }}>
            <TextInput
              placeholder={mode === "message" ? "Paste message to analyze" : "Paste Link to Analyze"}
              placeholderTextColor={colors.textMuted}
              multiline={mode === "message"}
              autoCapitalize="none"
              value={universalText}
              onChangeText={setUniversalText}
              style={{ color: colors.text, flex: 1, fontSize: 12, textAlignVertical: mode === "message" ? "top" : "center", paddingVertical: 9 }}
            />
            <Pressable onPress={() => pasteText(setUniversalText)} hitSlop={8}>
              <Ionicons name="clipboard-outline" size={17} color={colors.primaryBright} />
            </Pressable>
          </View>
          <GradientButton
            label={mode === "message" ? "Analyze Message" : "Analyze Link"}
            icon={mode === "message" ? "chatbubble-outline" : "link-outline"}
            onPress={runUniversal}
            disabled={!universalText.trim()}
            loading={loading && !advancedOpen}
          />
          {loading && !advancedOpen ? <AnalyzingOverlay /> : null}
        </View>

        {!!recentScans?.length && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 7 }}>Recent Scans</Text>
            {recentScans.slice(0, 2).map((scan) => (
              <ScanCard key={scan.id} scan={scan} onPress={() => navigate(scan)} />
            ))}
          </View>
        )}

        {/* Scam coach — for situations, not artifacts */}
        <PressableFX
          onPress={() => router.push("/coach" as any)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.glass,
            borderWidth: 1,
            borderColor: colors.borderHi,
            marginBottom: spacing.lg,
          }}
          pressedStyle={{ backgroundColor: colors.glassActive }}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={colors.primaryBright} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Ask about a situation…</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Nothing to paste? Describe what&apos;s happening and get a straight answer.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableFX>

        {/* Advanced: specific scan types */}
        <Pressable
          onPress={() => setAdvancedOpen((open) => !open)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md, alignSelf: "flex-start" }}
          hitSlop={8}
        >
          <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
            MORE SCAN TYPES
          </Text>
          <Ionicons name={advancedOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textDim} />
        </Pressable>

        {advancedOpen && (
        <>
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

          {mode === "voice" && (
            <>
              <Pressable
                onPress={listening ? stopListening : startListening}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  backgroundColor: listening ? `${colors.critical}22` : `${active.accent}18`,
                  borderColor: listening ? colors.critical : active.accent,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <Ionicons
                  name={listening ? "stop-circle" : "mic"}
                  size={22}
                  color={listening ? colors.critical : active.accent}
                />
                <Text style={{ color: listening ? colors.critical : active.accent, fontWeight: "800", fontSize: 15 }}>
                  {listening ? "Listening… tap to stop" : "Tap, then play the voicemail"}
                </Text>
              </Pressable>

              <FieldLabel>Transcript</FieldLabel>
              <TextInput
                placeholder="The transcript appears here as it listens — or type/paste the voicemail yourself…"
                placeholderTextColor={colors.textMuted}
                multiline
                value={voiceTranscript}
                onChangeText={setVoiceTranscript}
                style={multilineStyle}
              />
              <FieldLabel>Caller Number (optional)</FieldLabel>
              <TextInput
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={voiceCaller}
                onChangeText={setVoiceCaller}
                style={inputStyle}
              />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
                Audio is transcribed on your device — the recording never leaves your phone.
              </Text>
              <PrimaryButton
                loading={loading}
                label={active.cta}
                onPress={runVoice}
                disabled={voiceTranscript.trim().length < 10}
                icon="flash-outline"
              />
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
        </>
        )}

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
