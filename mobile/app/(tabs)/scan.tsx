import * as Clipboard from "expo-clipboard";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

type ScanMode = "link" | "image" | "qr" | "message" | "email" | "phone" | "marketplace" | "social";

const MODES: Array<{
  value: ScanMode;
  label: string;
  icon: string;
  color: string;
}> = [
  { value: "link",        label: "Link",        icon: "🔗", color: colors.primaryBright },
  { value: "image",       label: "Screenshot",  icon: "📸", color: colors.teal },
  { value: "message",     label: "Message",     icon: "💬", color: colors.safe },
  { value: "email",       label: "Email",       icon: "✉️", color: colors.accent },
  { value: "phone",       label: "Phone",       icon: "📞", color: colors.suspicious },
  { value: "marketplace", label: "Marketplace", icon: "🛒", color: colors.low },
  { value: "social",      label: "Social",      icon: "👥", color: colors.purple },
  { value: "qr",          label: "QR Code",     icon: "📷", color: colors.rose },
];

const MODE_PLACEHOLDERS: Record<ScanMode, string> = {
  link: "Paste a suspicious URL…",
  image: "",
  qr: "",
  message: "Paste the suspicious message…",
  email: "Paste the email body…",
  phone: "+1 (555) 000-0000",
  marketplace: "Paste the listing or buyer message…",
  social: "Paste the post or DM…",
};

const MODE_PROMPTS: Record<ScanMode, string> = {
  link: "Paste any URL — get a risk score and red flags in seconds.",
  image: "Upload a screenshot of a suspicious message, email, or website.",
  qr: "Point your camera at a QR code to preview its destination safely.",
  message: "Copy a suspicious text, WhatsApp, or iMessage and paste it here.",
  email: "Fill in the details from a suspicious email to detect phishing.",
  phone: "Enter a phone number to check its spam and scam reputation.",
  marketplace: "Paste a listing or buyer/seller message to detect scam patterns.",
  social: "Paste a social post or DM to check for giveaways, impersonation, or crypto lures.",
};

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const [mode, setMode] = useState<ScanMode>((params.type as ScanMode) ?? "link");

  useEffect(() => {
    if (params.type) setMode(params.type as ScanMode);
  }, [params.type]);

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

  const navigate = (scan: { id: string }) => router.push(`/result?id=${scan.id}` as any);

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

  const runLink = () => wrap(() => ShieldAPI.scanLink(url.trim()));

  const runImage = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    setLoading(true);
    try {
      navigate(await ShieldAPI.scanImage(res.assets[0].base64!));
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

  const runMessage = () => wrap(() => ShieldAPI.scanMessage(messageText.trim(), platformHint));

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
  const runMarketplace = () => wrap(() => ShieldAPI.scanMarketplace(marketplaceText.trim(), marketplacePlatform));
  const runSocial = () => wrap(() => ShieldAPI.scanSocial(socialText.trim(), socialPlatform));

  const activeMode = MODES.find((m) => m.value === mode)!;

  const inputBase = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    fontSize: 15,
  } as const;

  const multilineInput = { ...inputBase, height: 130, textAlignVertical: "top" as const };

  function PlatformPills({
    options,
    value,
    onSelect,
  }: {
    options: string[];
    value: string;
    onSelect: (v: string) => void;
  }) {
    return (
      <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginBottom: spacing.sm }}>
        {options.map((p) => (
          <Pressable
            key={p || "other"}
            onPress={() => onSelect(p)}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 5,
              borderRadius: radius.pill,
              backgroundColor: value === p ? activeMode.color : colors.surface,
              borderColor: value === p ? activeMode.color : colors.border,
              borderWidth: 1,
            }}
          >
            <Text
              style={{
                color: value === p ? "#fff" : colors.textMuted,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {p || "Other"}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function AnalyzeButton({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={{
          backgroundColor: disabled || loading ? colors.surface : activeMode.color,
          borderWidth: disabled || loading ? 1 : 0,
          borderColor: colors.border,
          padding: spacing.md,
          borderRadius: radius.lg,
          alignItems: "center",
          marginTop: spacing.sm,
        }}
      >
        {loading ? (
          <ActivityIndicator color={disabled ? colors.textMuted : "#fff"} />
        ) : (
          <Text
            style={{
              color: disabled ? colors.textMuted : "#fff",
              fontWeight: "800",
              fontSize: 16,
            }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  }

  function FieldLabel({ children }: { children: string }) {
    return (
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.8,
          marginBottom: 5,
          marginTop: spacing.sm,
        }}
      >
        {children.toUpperCase()}
      </Text>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "900",
            letterSpacing: -0.7,
          }}
        >
          Analyze
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
          What are you checking?
        </Text>
      </View>

      {/* Mode selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {MODES.map(({ value, label, icon, color }) => {
          const active = mode === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                setMode(value);
                setError(null);
              }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: active ? color + "22" : colors.surface,
                borderColor: active ? color : colors.border,
                borderWidth: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14 }}>{icon}</Text>
              <Text
                style={{
                  color: active ? color : colors.textMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Active mode prompt */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.lg,
            backgroundColor: activeMode.color + "14",
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: activeMode.color + "30",
            padding: spacing.md,
          }}
        >
          <Text style={{ fontSize: 22 }}>{activeMode.icon}</Text>
          <Text
            style={{
              flex: 1,
              color: activeMode.color,
              fontSize: 13,
              lineHeight: 18,
              fontWeight: "600",
            }}
          >
            {MODE_PROMPTS[mode]}
          </Text>
        </View>

        {/* Link */}
        {mode === "link" && (
          <>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                placeholder={MODE_PLACEHOLDERS.link}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                value={url}
                onChangeText={setUrl}
                style={{ ...inputBase, flex: 1 }}
              />
              <Pressable
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  if (text) setUrl(text.trim());
                }}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.primaryBright, fontWeight: "700", fontSize: 13 }}>
                  Paste
                </Text>
              </Pressable>
            </View>
            <AnalyzeButton label="Analyze Link" onPress={runLink} disabled={!url.trim()} />
          </>
        )}

        {/* Screenshot */}
        {mode === "image" && (
          <AnalyzeButton label="Choose Screenshot" onPress={runImage} />
        )}

        {/* QR Code */}
        {mode === "qr" && (
          <>
            {!cameraPermission?.granted ? (
              <Pressable
                onPress={requestCameraPermission}
                style={{
                  backgroundColor: activeMode.color,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Allow Camera Access</Text>
              </Pressable>
            ) : (
              <View style={{ borderRadius: radius.xl, overflow: "hidden", height: 300 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={loading ? undefined : handleQRScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                {loading && (
                  <View
                    style={{
                      ...absoluteFill,
                      backgroundColor: "rgba(6,6,11,0.75)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator color={colors.rose} size="large" />
                    <Text style={{ color: "#fff", marginTop: spacing.sm, fontWeight: "700" }}>
                      Analyzing…
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Message */}
        {mode === "message" && (
          <>
            <TextInput
              placeholder={MODE_PLACEHOLDERS.message}
              placeholderTextColor={colors.textMuted}
              multiline
              value={messageText}
              onChangeText={setMessageText}
              style={multilineInput}
            />
            <FieldLabel>Source (optional)</FieldLabel>
            <PlatformPills
              options={["", "sms", "whatsapp", "imessage", "telegram"]}
              value={platformHint}
              onSelect={setPlatformHint}
            />
            <AnalyzeButton
              label="Analyze Message"
              onPress={runMessage}
              disabled={!messageText.trim()}
            />
          </>
        )}

        {/* Email */}
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
              style={inputBase}
            />
            <FieldLabel>Display Name Shown</FieldLabel>
            <TextInput
              placeholder="e.g. PayPal Support"
              placeholderTextColor={colors.textMuted}
              value={emailDisplayName}
              onChangeText={setEmailDisplayName}
              style={inputBase}
            />
            <FieldLabel>Reply-To Address</FieldLabel>
            <TextInput
              placeholder="reply-to@example.com (if different)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailReplyTo}
              onChangeText={setEmailReplyTo}
              style={inputBase}
            />
            <FieldLabel>Subject</FieldLabel>
            <TextInput
              placeholder="Email subject line"
              placeholderTextColor={colors.textMuted}
              value={emailSubject}
              onChangeText={setEmailSubject}
              style={inputBase}
            />
            <FieldLabel>Body</FieldLabel>
            <TextInput
              placeholder="Paste the email body here…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={emailBody}
              onChangeText={setEmailBody}
              style={multilineInput}
            />
            <AnalyzeButton
              label="Analyze Email"
              onPress={runEmail}
              disabled={!emailSender && !emailSubject && !emailBody}
            />
          </>
        )}

        {/* Phone */}
        {mode === "phone" && (
          <>
            <TextInput
              placeholder={MODE_PLACEHOLDERS.phone}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={inputBase}
            />
            <AnalyzeButton
              label="Look Up Number"
              onPress={runPhone}
              disabled={!phoneNumber.trim()}
            />
          </>
        )}

        {/* Marketplace */}
        {mode === "marketplace" && (
          <>
            <TextInput
              placeholder={MODE_PLACEHOLDERS.marketplace}
              placeholderTextColor={colors.textMuted}
              multiline
              value={marketplaceText}
              onChangeText={setMarketplaceText}
              style={multilineInput}
            />
            <FieldLabel>Platform (optional)</FieldLabel>
            <PlatformPills
              options={["", "facebook", "ebay", "craigslist", "offerup"]}
              value={marketplacePlatform}
              onSelect={setMarketplacePlatform}
            />
            <AnalyzeButton
              label="Analyze Listing"
              onPress={runMarketplace}
              disabled={!marketplaceText.trim()}
            />
          </>
        )}

        {/* Social */}
        {mode === "social" && (
          <>
            <TextInput
              placeholder={MODE_PLACEHOLDERS.social}
              placeholderTextColor={colors.textMuted}
              multiline
              value={socialText}
              onChangeText={setSocialText}
              style={multilineInput}
            />
            <FieldLabel>Platform (optional)</FieldLabel>
            <PlatformPills
              options={["", "instagram", "facebook", "twitter", "tiktok", "youtube"]}
              value={socialPlatform}
              onSelect={setSocialPlatform}
            />
            <AnalyzeButton
              label="Analyze Post"
              onPress={runSocial}
              disabled={!socialText.trim()}
            />
          </>
        )}

        {error && (
          <View
            style={{
              backgroundColor: colors.criticalDim,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.critical + "40",
              padding: spacing.md,
              marginTop: spacing.md,
            }}
          >
            <Text style={{ color: colors.critical, textAlign: "center", fontWeight: "600" }}>
              {error}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const absoluteFill = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
