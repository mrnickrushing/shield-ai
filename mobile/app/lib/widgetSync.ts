import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type WidgetSyncNativeModule = {
  writeSnapshot: (snapshot: Record<string, number>) => Promise<boolean>;
};

function getNativeModule(): WidgetSyncNativeModule | null {
  if (Platform.OS !== "ios") return null;
  try {
    return requireNativeModule<WidgetSyncNativeModule>("WidgetSync");
  } catch {
    return null;
  }
}

export type ProtectionStatsSnapshot = {
  scansThisWeek: number;
  threatsBlocked: number;
  callsProtected: number;
};

export async function syncWidgetSnapshot(snapshot: ProtectionStatsSnapshot): Promise<void> {
  const native = getNativeModule();
  if (!native) return;
  // lastSyncAt (epoch seconds) lets the widget show how fresh its numbers are.
  await native.writeSnapshot({ ...snapshot, lastSyncAt: Math.floor(Date.now() / 1000) });
}
