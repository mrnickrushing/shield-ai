import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

type ScanMode = "link" | "image" | "qr" | "message" | "email" | "phone" | "marketplace" | "social";

const MODES: { value: ScanMode; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "image", label: "Screenshot" },
  { value: "qr", label: "QR Code" },
  { value: "message", label: "Message" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "marketplace", label: "Marketplace" },
  { value: "social", label: "Social" },
];

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [mode, setMode] = useState<ScanMode>((params.type as ScanMode) ?? "link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrScanned = useRef(false);

  // Link
  const [url, setUrl] = useState("");

  // Message
  const [messageText, setMessageText] = useState("");
  const [platformHint, setPlatformHint] = useState("");

  // Email
  const [emailSender, setEmailSender] = useState("");
  const [emailDisplayName, setEmailDisplayName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Phone
  const [phoneNumber, setPhoneNumber] = useState("");

  // Marketplace
  const [marketplaceText, setMarketplaceText] = useState("");
  const [marketplacePlatform, setMarketplacePlatform] = useState("");

  // Social
  const [socialText, setSocialText] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("");

  // Camera permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

  const runMessage = () =>
    wrap(() => ShieldAPI.scanMessage(messageText.trim(), platformHint));

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
    wrap(() => ShieldAPI.scanMarketplace(marketplaceText.trim(), marketplacePlatform));

  const runSocial = () =>
    wrap(() => ShieldAPI.scanSocial(socialText.trim(), socialPlatform));

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.sm,
  } as const;

  const multilineStyle = { ...inputStyle, height: 120, textAlignVertical: "top" as const };

  const Btn = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled || loading ? colors.surface : colors.primary,
        padding: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
        marginTop: spacing.sm,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Mode tabs — scrollable row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs, padding: spacing.md }}
        style={{ flexGrow: 0 }}
      >
        {MODES.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => { setMode(value); setError(null); }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: mode === value ? colors.primary : colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: mode === value ? "#fff" : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>

        {/* Link */}
        {mode === "link" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Paste a suspicious URL to check.
            </Text>
            <TextInput
              placeholder="https://…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              value={url}
              onChangeText={setUrl}
              style={inputStyle}
            />
            <Btn label="Analyze Link" onPress={runLink} disabled={!url.trim()} />
          </>
        )}

        {/* Screenshot */}
        {mode === "image" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Upload a screenshot of a suspicious message, email, or website.
            </Text>
            <Btn label="Choose Screenshot" onPress={runImage} />
          </>
        )}

        {/* QR Code */}
        {mode === "qr" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Point your camera at a QR code to preview its destination before opening.
            </Text>
            {!cameraPermission?.granted ? (
              <Pressable
                onPress={requestCameraPermission}
                style={{ backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Allow Camera Access</Text>
              </Pressable>
            ) : (
              <View style={{ borderRadius: radius.lg, overflow: "hidden", height: 300 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={loading ? undefined : handleQRScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                {loading && (
                  <View style={{
                    ...StyleSheet_absoluteFill,
                    backgroundColor: "rgba(2,6,23,0.7)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <ActivityIndicator color={colors.primaryBright} size="large" />
                    <Text style={{ color: "#fff", marginTop: spacing.sm }}>Analyzing…</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Message */}
        {mode === "message" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Paste a suspicious text message, chat, or marketplace message.
            </Text>
            <TextInput
              placeholder="Paste the message here…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={messageText}
              onChangeText={setMessageText}
              style={multilineStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>
              Source (optional)
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>
              {(["", "sms", "whatsapp", "imessage", "telegram"] as const).map((ph) => (
                <Pressable
                  key={ph || "other"}
                  onPress={() => setPlatformHint(ph)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: platformHint === ph ? colors.primary : colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: platformHint === ph ? "#fff" : colors.textMuted, fontSize: 12 }}>
                    {ph || "Other"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Btn label="Analyze Message" onPress={runMessage} disabled={!messageText.trim()} />
          </>
        )}

        {/* Email */}
        {mode === "email" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Enter email details to check for spoofing and phishing.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Sender address</Text>
            <TextInput
              placeholder="sender@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailSender}
              onChangeText={setEmailSender}
              style={inputStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Display name shown</Text>
            <TextInput
              placeholder="e.g. PayPal Support"
              placeholderTextColor={colors.textMuted}
              value={emailDisplayName}
              onChangeText={setEmailDisplayName}
              style={inputStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Reply-To address</Text>
            <TextInput
              placeholder="reply-to@example.com (if different)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailReplyTo}
              onChangeText={setEmailReplyTo}
              style={inputStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Subject</Text>
            <TextInput
              placeholder="Email subject line"
              placeholderTextColor={colors.textMuted}
              value={emailSubject}
              onChangeText={setEmailSubject}
              style={inputStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Body (paste email content)</Text>
            <TextInput
              placeholder="Paste the email body here…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={emailBody}
              onChangeText={setEmailBody}
              style={multilineStyle}
            />
            <Btn
              label="Analyze Email"
              onPress={runEmail}
              disabled={!emailSender && !emailSubject && !emailBody}
            />
          </>
        )}

        {/* Phone */}
        {mode === "phone" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Enter a phone number to check its spam and scam reputation.
            </Text>
            <TextInput
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={inputStyle}
            />
            <Btn label="Look Up Number" onPress={runPhone} disabled={!phoneNumber.trim()} />
          </>
        )}

        {/* Marketplace */}
        {mode === "marketplace" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Paste a marketplace listing or buyer/seller message to check for scams.
            </Text>
            <TextInput
              placeholder="Paste the listing or message here…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={marketplaceText}
              onChangeText={setMarketplaceText}
              style={multilineStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>
              Platform (optional)
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm, flexWrap: "wrap" }}>
              {(["", "facebook", "ebay", "craigslist", "offerup"] as const).map((p) => (
                <Pressable
                  key={p || "other"}
                  onPress={() => setMarketplacePlatform(p)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: marketplacePlatform === p ? colors.primary : colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: marketplacePlatform === p ? "#fff" : colors.textMuted, fontSize: 12 }}>
                    {p || "Other"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Btn label="Analyze Listing" onPress={runMarketplace} disabled={!marketplaceText.trim()} />
          </>
        )}

        {/* Social */}
        {mode === "social" && (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              Paste a social media post or DM to check for giveaway scams, impersonation, or crypto lures.
            </Text>
            <TextInput
              placeholder="Paste the post or message here…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={socialText}
              onChangeText={setSocialText}
              style={multilineStyle}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }}>
              Platform (optional)
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm, flexWrap: "wrap" }}>
              {(["", "instagram", "facebook", "twitter", "tiktok", "youtube"] as const).map((p) => (
                <Pressable
                  key={p || "other"}
                  onPress={() => setSocialPlatform(p)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: socialPlatform === p ? colors.primary : colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: socialPlatform === p ? "#fff" : colors.textMuted, fontSize: 12 }}>
                    {p || "Other"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Btn label="Analyze Post" onPress={runSocial} disabled={!socialText.trim()} />
          </>
        )}

        {error && (
          <Text style={{ color: colors.critical, marginTop: spacing.md, textAlign: "center" }}>
            {error}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Inline helper to avoid importing StyleSheet just for absoluteFill
const StyleSheet_absoluteFill = {
  position: "absolute" as const,
  top: 0, left: 0, right: 0, bottom: 0,
};
