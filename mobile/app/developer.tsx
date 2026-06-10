import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ShieldAPI } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/theme";

export default function DeveloperScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => ShieldAPI.listApiKeys(),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: () => ShieldAPI.createApiKey(keyName.trim() || "Default"),
    onSuccess: (data) => {
      setNewKey(data.raw_key);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => ShieldAPI.revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.primaryBright }}>← Back</Text>
      </Pressable>

      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 4 }}>
        API Access
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: spacing.lg }}>
        Use Shield AI scan endpoints programmatically with an API key.
      </Text>

      {/* Create key */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderColor: colors.border,
        borderWidth: 1,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: spacing.sm }}>
          Create API Key
        </Text>
        <View>
          <TextInput
            placeholder="Key name (e.g. Production)"
            placeholderTextColor={colors.textMuted}
            value={keyName}
            onChangeText={setKeyName}
            style={inputStyle}
          />
          <Pressable
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, alignItems: "center" }}
          >
            {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Create</Text>}
          </Pressable>
        </View>

        {newKey && (
          <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
            <Text style={{ color: colors.safe, fontWeight: "700", marginBottom: 4 }}>
              Key created — copy it now. It won't be shown again.
            </Text>
            <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }} selectable>
              {newKey}
            </Text>
          </View>
        )}
      </View>

      {/* Key list */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderColor: colors.border,
        borderWidth: 1,
        padding: spacing.lg,
      }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: spacing.sm }}>
          Your Keys
        </Text>
        {isLoading && <ActivityIndicator color={colors.primaryBright} />}
        {keys?.length === 0 && <Text style={{ color: colors.textMuted }}>No active keys.</Text>}
        {keys?.map((key) => (
          <View key={key.id} style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.bg,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.xs,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{key.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: "monospace" }}>
                {key.key_prefix}…
              </Text>
            </View>
            <Pressable
              onPress={() => revokeMutation.mutate(key.id)}
              disabled={revokeMutation.isPending}
              style={{ backgroundColor: colors.critical + "22", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, opacity: revokeMutation.isPending ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.critical, fontSize: 12, fontWeight: "700" }}>Revoke</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Authentication</Text>
          <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 11 }} selectable>
            X-API-Key: shld_your_key_here
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
            All scan endpoints accept this header as an alternative to Bearer JWT.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
