import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ShieldAPI } from "@/lib/api";

export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

function isAllowed(permission: Notifications.NotificationPermissionsStatus) {
  if (permission.granted) return true;

  const iosStatus = permission.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export function notificationPermissionState(
  permission: Notifications.NotificationPermissionsStatus
): NotificationPermissionState {
  if (isAllowed(permission)) return "granted";
  if (
    permission.status === Notifications.PermissionStatus.DENIED ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.DENIED
  ) {
    return "denied";
  }
  return "undetermined";
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === "web" || !Constants.isDevice) return "unsupported";
  return notificationPermissionState(await Notifications.getPermissionsAsync());
}

export async function registerDeviceForPush({
  requestPermission = false,
}: {
  requestPermission?: boolean;
} = {}): Promise<NotificationPermissionState> {
  if (Platform.OS === "web" || !Constants.isDevice) return "unsupported";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Security alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#50D5FF",
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  let state = notificationPermissionState(permission);

  if (requestPermission && state === "undetermined") {
    permission = await Notifications.requestPermissionsAsync();
    state = notificationPermissionState(permission);
  }
  if (state !== "granted") return state;

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  await ShieldAPI.registerDevice(
    tokenResponse.data,
    Platform.OS === "ios" ? "ios" : "android"
  );
  return state;
}

export async function unregisterDeviceForPush(): Promise<void> {
  if (Platform.OS === "web" || !Constants.isDevice) return;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    await ShieldAPI.unregisterDevice(tokenResponse.data);
  } catch {
    // Session revocation still proceeds if Expo or the network is unavailable.
  }
}
