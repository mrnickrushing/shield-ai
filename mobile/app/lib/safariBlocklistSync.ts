import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

import { ShieldAPI } from "@/lib/api";

type SyncNativeModule = {
  writeUrlBlocklistSnapshot: (domains: string[]) => Promise<boolean>;
};

function getNativeModule(): SyncNativeModule | null {
  // Lives in the CallDirectorySync module (both write App Group snapshots);
  // absent in Expo Go / Android.
  if (Platform.OS !== "ios") return null;
  try {
    return requireNativeModule<SyncNativeModule>("CallDirectorySync");
  } catch {
    return null;
  }
}

export type SafariBlocklistSyncResult = {
  synced: boolean;
  count: number;
  version: string;
};

/** Snapshot community-flagged domains for the Safari Web Extension. */
export async function syncSafariBlocklist(): Promise<SafariBlocklistSyncResult> {
  const native = getNativeModule();
  if (!native) {
    return { synced: false, count: 0, version: "0" };
  }
  const { version, domains } = await ShieldAPI.syncUrlReputation();
  await native.writeUrlBlocklistSnapshot(domains);
  return { synced: true, count: domains.length, version };
}
