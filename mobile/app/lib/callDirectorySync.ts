import { requireNativeModule } from "expo-modules-core";
import { Linking, Platform } from "react-native";

import { PhoneReputationEntry, ShieldAPI } from "@/lib/api";

type CallDirectorySyncNativeModule = {
  writeBlocklistSnapshot: (entries: PhoneReputationEntry[]) => Promise<boolean>;
  reloadCallDirectoryExtension: () => Promise<boolean>;
  openCallDirectorySettings: () => Promise<boolean>;
};

function getNativeModule(): CallDirectorySyncNativeModule | null {
  // The native binding only exists in a real prebuilt iOS app (not Expo Go,
  // not Android) — requireNativeModule throws when it's absent.
  if (Platform.OS !== "ios") return null;
  try {
    return requireNativeModule<CallDirectorySyncNativeModule>("CallDirectorySync");
  } catch {
    return null;
  }
}

export type CallProtectionSyncResult = {
  synced: boolean;
  count: number;
  version: string;
};

/** Opens Settings → Phone → Call Blocking & Identification directly via CallKit's public API. */
export async function openCallDirectorySettings(): Promise<void> {
  const native = getNativeModule();
  if (!native) {
    Linking.openSettings();
    return;
  }
  try {
    await native.openCallDirectorySettings();
  } catch {
    Linking.openSettings();
  }
}

export async function syncCallProtection(): Promise<CallProtectionSyncResult> {
  const native = getNativeModule();
  if (!native) {
    return { synced: false, count: 0, version: "0" };
  }

  const { version, entries } = await ShieldAPI.syncPhoneReputation();
  await native.writeBlocklistSnapshot(entries);
  await native.reloadCallDirectoryExtension();

  return { synced: true, count: entries.length, version };
}
