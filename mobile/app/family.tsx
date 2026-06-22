import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button, Chip, Eyebrow, FadeIn, GlowOrb, Surface } from "@/components/ui";
import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing, withAlpha } from "@/theme/theme";

const REL_LABELS = ["Parent", "Spouse", "Sibling", "Child", "Friend", "Caregiver", "Other"];

export default function FamilyScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rel, setRel] = useState("Friend");

  const { data: contacts = [] } = useQuery({ queryKey: ["trusted-contacts"], queryFn: ShieldAPI.listContacts });
  const addContact = useMutation({
    mutationFn: () => ShieldAPI.addContact({ name, phone, email, relationship_label: rel }),
    onSuccess: () => {
      setShowAdd(false);
      setName("");
      setPhone("");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["trusted-contacts"] });
    },
  });
  const removeContact = useMutation({
    mutationFn: (id: string) => ShieldAPI.removeContact(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trusted-contacts"] }),
  });
  const confirmRemove = (id: string, contactName: string) =>
    Alert.alert("Remove Contact", `Remove ${contactName} from trusted contacts?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeContact.mutate(id) },
    ]);

  const inputFields = [
    { label: "Name *", value: name, setter: setName, placeholder: "Full name" },
    { label: "Phone", value: phone, setter: setPhone, placeholder: "+1 555 000 0000" },
    { label: "Email", value: email, setter: setEmail, placeholder: "their@email.com" },
  ] as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FadeIn>
        <Surface
          accent={colors.rose}
          glow={withAlpha(colors.rose, "30")}
          style={{ marginBottom: spacing.lg, position: "relative" }}
        >
          <GlowOrb color={colors.rose} size={200} opacity={0.28} style={{ top: -60, right: -50 }} />
          <Eyebrow style={{ marginBottom: spacing.sm }}>FAMILY PROTECTION</Eyebrow>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, marginBottom: 6 }}>
            Keep help one tap away.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
            Trusted contacts are people you can escalate alerts to if you spot something suspicious.
          </Text>
        </Surface>
      </FadeIn>

      {(contacts as any[]).length === 0 && !showAdd && (
        <FadeIn delay={60}>
          <Surface style={{ alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.lg }}>
            <Ionicons name="people-outline" size={36} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>No contacts yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
              Add a trusted friend or family member to share scam alerts with.
            </Text>
          </Surface>
        </FadeIn>
      )}

      {(contacts as any[]).length > 0 && (
        <FadeIn delay={60}>
          {(contacts as any[]).map((c: any) => (
            <Surface key={c.id} style={{ marginBottom: spacing.md, flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: withAlpha(colors.primary, "33"),
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: spacing.md,
                }}
              >
                <Text style={{ color: colors.primaryBright, fontSize: 18, fontWeight: "800" }}>{c.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{c.name}</Text>
                {c.relationship_label ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.relationship_label}</Text> : null}
                {c.phone ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.phone}</Text> : null}
                {c.email ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.email}</Text> : null}
              </View>
              <Pressable onPress={() => confirmRemove(c.id, c.name)} style={{ padding: spacing.sm }} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.critical} />
              </Pressable>
            </Surface>
          ))}
        </FadeIn>
      )}

      <FadeIn delay={100}>
        {showAdd ? (
          <Surface style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: spacing.md }}>New Contact</Text>
            {inputFields.map((f) => (
              <View key={f.label} style={{ marginBottom: spacing.sm }}>
                <Eyebrow style={{ marginBottom: 4 }}>{f.label}</Eyebrow>
                <TextInput
                  value={f.value}
                  onChangeText={f.setter as any}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    color: colors.text,
                    padding: spacing.md,
                    fontSize: 15,
                  }}
                />
              </View>
            ))}
            <Eyebrow style={{ marginBottom: 4, marginTop: spacing.sm }}>Relationship</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {REL_LABELS.map((r) => (
                  <Chip key={r} label={r} active={rel === r} onPress={() => setRel(r)} />
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button label="Cancel" variant="secondary" onPress={() => setShowAdd(false)} style={{ flex: 1 }} />
              <Button
                label="Add Contact"
                onPress={() => {
                  if (name) addContact.mutate();
                }}
                disabled={!name}
                loading={addContact.isPending}
                style={{ flex: 2 }}
              />
            </View>
          </Surface>
        ) : (
          <Button label="Add Trusted Contact" icon="person-add-outline" onPress={() => setShowAdd(true)} />
        )}
      </FadeIn>
    </ScrollView>
  );
}
