/**
 * Server-side Expo Push Notification helper.
 * Sends notifications via the Expo Push API — no Firebase SDK needed on the server.
 * Expo handles FCM (Android) and APNs (iOS) delivery internally.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string | string[];   // Expo push token(s)
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send one or more push notifications.
 * Tokens that are invalid are silently ignored (Expo reports them per-ticket).
 */
export async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo accepts up to 100 messages per request — chunk if needed
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      // We intentionally don't throw on Expo errors — a bad token shouldn't
      // fail the whole checkout/status-update request.
    } catch {
      // Network error sending push — log and continue
      console.warn("[push] Failed to send push notification batch");
    }
  }
}

/** Convenience wrapper for a single token. */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!token || !token.startsWith("ExponentPushToken[")) return;
  await sendPushNotifications([{ to: token, title, body, data, sound: "default" }]);
}

/** Send to multiple tokens, filtering out invalid ones. */
export async function sendPushToTokens(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const valid = tokens.filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));
  if (valid.length === 0) return;
  await sendPushNotifications(valid.map((to) => ({ to, title, body, data, sound: "default" as const })));
}
