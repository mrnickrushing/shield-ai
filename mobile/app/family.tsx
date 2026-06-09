import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

const REL_LABELS = ["Parent", "Spouse", "Sibling", "Child", "Friend", "Caregiver", "Other"];

export default function FamilyScreen() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rel, setRel] = useState("Friend");

  const { data: contacts = [] } = useQuery({
    queryKey: ["trusted-contacts"],
    queryFn: ShieldAPI.listContacts,
  });

  const addContact = useMutation({
    mutationFn: () => ShieldAPI.addContact({ name, phone, email, relationship_label: rel }),
    onSuccess: () => {
      setShowAdd(false);
      setName(""); setPhone(""); setEmail("");
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Family Protection</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>
        Trusted contacts are people you can escalate alerts to if you spot something suspicious.
      </Text>

      {(contacts as any[]).length === 0 && !showAdd && (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", marginBottom: spacing.lg }}>
          <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>👨‍👩‍👧</Text>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>No contacts yet</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
            Add a trusted friend or family member to share scam alerts with.
          </Text>
        </View>
      )}

      {(contacts as any[]).map((c: any) => (
        <View
          key={c.id}
          style={{
            backgroundColor: colors.surface, borderColor: colors.border,
            borderWidth: 1, borderRadius: radius.lg,
            padding: spacing.lg, marginBottom: spacing.md,
            flexDirection: "row", alignItems: "center",
          }}
        >
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.primary + "33",
            alignItems: "center", justifyContent: "center", marginRight: spacing.md,
          }}>
            <Text style={{ color: colors.primaryBright, fontSize: 18, fontWeight: "800" }}>
              {c.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{c.name}</Text>
            {c.relationship_label ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.relationship_label}</Text> : null}
            {c.phone ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.phone}</Text> : null}
            {c.email ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.email}</Text> : null}
          </View>
          <Pressable onPress={() => confirmRemove(c.id, c.name)} style={{ padding: spacing.sm }}>
            <Text style={{ color: colors.critical, fontSize: 22 }}>×</Text>
          </Pressable>
        </View>
      ))}

      {showAdd ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: spacing.md }}>New Contact</Text>
          {([
            { label: "Name *", value: name, setter: setName, placeholder: "Full name" },
            { label: "Phone", value: phone, setter: setPhone, placeholder: "+1 555 000 0000" },
            { label: "Email", value: email, setter: setEmail, placeholder: "their@email.com" },
          ] as const).map((f) => (
            <View key={f.label} style={{ marginBottom: spacing.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.setter as any}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.bg, borderColor: colors.border,
                  borderWidth: 1, borderRadius: radius.md,
                  color: colors.text, padding: spacing.md, fontSize: 15,
                }}
              />
            </View>
          ))}
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4, marginTop: spacing.sm }}>Relationship</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {REL_LABELS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRel(r)}
                  style={{
                    backgroundColor: rel === r ? colors.primary : colors.bg,
                    borderColor: rel === r ? colors.primary : colors.border,
                    borderWidth: 1, borderRadius: 20,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                  }}
                >
                  <Text style={{ color: rel === r ? "#fff" : colors.textMuted, fontSize: 13 }}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => setShowAdd(false)}
              style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (name) addContact.mutate(); }}
              style={{ flex: 2, backgroundColor: name ? colors.primary : colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Add Contact</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>+ Add Trusted Contact</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
