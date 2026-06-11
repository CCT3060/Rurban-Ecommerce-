import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_BASE } from "./api";

/**
 * Request notification permissions and get the Expo Push Token.
 * Returns null if running on simulator, permissions denied, or any error.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("[push] Skipping push token — running on simulator/emulator");
    return null;
  }

  // Android: create a notification channel (required for Android 8+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22c55e",
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[push] Permission denied");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;  // e.g. "ExponentPushToken[xxxx]"
  } catch (err) {
    console.warn("[push] Failed to get push token:", err);
    return null;
  }
}

/**
 * Save the Expo push token to the server so we can send targeted notifications.
 */
export async function savePushToken(token: string | null, authToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/mobile/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: token }),
    });
  } catch (err) {
    console.warn("[push] Failed to save push token:", err);
  }
}

/**
 * Configure how notifications look when the app is in the foreground.
 * Call this once at app startup (before any other Notifications API call).
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}
