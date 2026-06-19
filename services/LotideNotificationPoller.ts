/*
    Project: Hoot Mobile
    -------------------

    File: LotideNotificationPoller.ts

    Purpose:

        Poll Lotide notifications in the background and raise local
        Android notifications for items Hoot has not already surfaced.

    Responsibilities:

        • Register and execute a background task for periodic polling
        • Keep a short-lived local dedupe set so the same notification
          is not surfaced multiple times
        • Send local notifications when polling discovers locally new items

    This file intentionally does NOT contain:

        • UI elements for notification settings
        • Notification list rendering or user-facing notification filters
*/

import { Platform } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import * as LotideService from "./LotideService";
import * as StorageService from "./StorageService";

/* ------------------------------------------------------------------------- */
/* Constants and Types                                                      */
/* ------------------------------------------------------------------------- */

const POLL_TASK_NAME = "hoot-mobile-lotide-notification-poll";
const POLL_INTERVAL_MINUTES = 15;
const SETTINGS_KEY = "@lotide_notification_background_enabled";
const STATE_KEY = "@lotide_notification_poll_state";
const MAX_TRACKED_NOTIFICATION_IDS = 250;

/*
    Android preserves a channel's user-facing importance and sound after the
    channel exists. The v2 suffix intentionally gives upgraded installs a fresh
    high-importance channel instead of reusing the earlier default channel.
*/
const NOTIFICATION_CHANNEL_ID = "lotide-notifications-v2";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotificationStateEntry = {
  initialized: boolean;
  ids: string[];
};

type NotificationState = {
  [accountKey: string]: NotificationStateEntry;
};

export type NotificationPollTaskRegistrationResult =
  | "registered"
  | "unregistered"
  | "unchanged"
  | "unavailable"
  | "skipped";

type NotificationPollTaskRegistrationOptions = {
  requireAvailable?: boolean;
};

export type NotificationNavigationTarget =
  | {
    screen: "Post";
    params: {
      postId: PostId;
      highlightedComments?: CommentId[];
    };
  }
  | {
    screen: "Notifications";
  }
  | {
    screen: "MessageThread";
    params: {
      userId: UserId;
      username?: string;
    };
  };

/* ------------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ------------------------------------------------------------------------- */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (value === null) return {};

  try {
    const data = JSON.parse(value) as unknown;
    return isObject(data) ? data : {};
  } catch {
    return {};
  }
}

function buildAccountKey(ctx: LotideContext): string {
  const username = ctx.login?.user?.username;
  const api = ctx.apiUrl ?? "unknown-api";
  const userTag = username ?? `user-${ctx.login?.user?.id ?? "unknown"}`;
  return `${api}::${userTag}`;
}

function notificationFingerprint(notification: FullNotification): string {
  if (notification.kind === "user_follow") {
    return `user_follow:${notification.actor?.id ?? notification.actor?.username ?? "unknown"}`;
  }

  if (notification.kind === "private_message") {
    return `private_message:${notification.message.id}`;
  }

  return `reply:${notification.origin.type}:${notification.postId}:${notification.commentId}:${notification.origin.id}`;
}

function notificationContent(notification: FullNotification) {
  if (notification.kind === "user_follow") {
    const actor = notification.actor?.username ?? "Someone";
    return {
      title: "New Lotide follower",
      body: `${actor} followed you`,
      sound: "default" as const,
    };
  }

  if (notification.kind === "private_message") {
    const actor = notification.message.author.username || "Someone";
    return {
      title: "New Lotide message",
      body: `${actor} sent you a message`,
      sound: "default" as const,
    };
  }

  if (notification.notificationType === "post_mention") {
    return {
      title: "New Lotide post mention",
      body: "Open the app to view the post that mentioned you.",
      sound: "default" as const,
    };
  }

  if (notification.notificationType === "comment_mention") {
    return {
      title: "New Lotide comment mention",
      body: "Open the app to view the comment that mentioned you.",
      sound: "default" as const,
    };
  }

  const isComment = notification.origin.type === "comment";
  return {
    title: isComment
      ? "New Lotide comment reply"
      : "New Lotide post reply",
    body: "Open the app to view your latest notifications.",
    sound: "default" as const,
  };
}

function notificationData(
  notification: FullNotification,
  ctx: LotideContext,
): Record<string, unknown> {
  if (notification.kind === "user_follow") {
    return {
      lotideKind: notification.kind,
      lotideActorId: notification.actor?.id,
    };
  }

  if (notification.kind === "private_message") {
    const loginUserId = ctx.login?.user?.id;
    const partner = LotideService.getPrivateMessagePartner(
      notification.message,
      loginUserId,
    );

    return {
      lotideKind: notification.kind,
      lotideMessageId: notification.message.id,
      lotidePartnerId: partner.id,
      lotidePartnerUsername: partner.username,
    };
  }

  return {
    lotidePostId: notification.postId,
    lotideCommentId: notification.commentId,
    lotideKind: notification.kind ?? "reply",
    lotideOriginType: notification.origin.type,
  };
}

function asPositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) {
    return Number(value);
  }

  return undefined;
}

export function getNotificationNavigationTarget(
  data: Record<string, unknown>,
): NotificationNavigationTarget | undefined {
  const postId = asPositiveInteger(data.lotidePostId);
  if (postId !== undefined) {
    const commentId = asPositiveInteger(data.lotideCommentId);

    return {
      screen: "Post",
      params: {
        postId,
        highlightedComments: commentId !== undefined ? [commentId] : undefined,
      },
    };
  }

  if (data.lotideKind === "user_follow") {
    return {
      screen: "Notifications",
    };
  }

  if (data.lotideKind === "private_message") {
    const userId = asPositiveInteger(data.lotidePartnerId);
    if (userId === undefined) return undefined;

    return {
      screen: "MessageThread",
      params: {
        userId,
        username:
          typeof data.lotidePartnerUsername === "string"
            ? data.lotidePartnerUsername
            : undefined,
      },
    };
  }

  return undefined;
}

export function getNotificationNavigationTargetFromResponse(
  response: Notifications.NotificationResponse | null,
): NotificationNavigationTarget | undefined {
  if (!response) return undefined;
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return undefined;
  }

  const data = response.notification.request.content.data;
  if (!data) return undefined;

  return getNotificationNavigationTarget(data);
}

export function getLastNotificationNavigationTarget():
  NotificationNavigationTarget | undefined {
  try {
    return getNotificationNavigationTargetFromResponse(
      Notifications.getLastNotificationResponse(),
    );
  } catch {
    return undefined;
  }
}

export function addNotificationResponseReceivedListener(
  listener: (target: NotificationNavigationTarget) => void,
): { remove: () => void } {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const target = getNotificationNavigationTargetFromResponse(response);
    if (target) {
      listener(target);
    }
  });
}

export function clearLastNotificationResponse() {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    /*
        The notification response cache is native-only. Some test and web
        environments do not expose it, and a failed clear should not prevent
        navigation after a user tapped a notification.
    */
  }
}

function normalizeNotificationStateEntry(
  value: unknown,
): NotificationStateEntry | undefined {
  if (Array.isArray(value)) {
    return {
      initialized: true,
      ids: value.filter(
        (item: unknown): item is string => typeof item === "string",
      ),
    };
  }

  if (!isObject(value)) return undefined;

  const ids = Array.isArray(value.ids)
    ? value.ids.filter(
      (item: unknown): item is string => typeof item === "string",
    )
    : [];

  return {
    initialized: value.initialized === true,
    ids,
  };
}

async function loadNotificationState(): Promise<NotificationState> {
  const stored = await AsyncStorage.getItem(STATE_KEY);
  const raw = parseJsonObject(stored);
  const out: NotificationState = {};

  Object.keys(raw).forEach(key => {
    const entry = normalizeNotificationStateEntry(raw[key]);
    if (entry) {
      out[key] = entry;
    }
  });

  return out;
}

async function getNotificationStateEntry(
  accountKey: string,
): Promise<NotificationStateEntry> {
  const state = await loadNotificationState();
  return state[accountKey] ?? {
    initialized: false,
    ids: [],
  };
}

async function setNotificationStateEntry(
  accountKey: string,
  entry: NotificationStateEntry,
): Promise<void> {
  const state = await loadNotificationState();
  const nextState = {
    ...state,
    [accountKey]: entry,
  };

  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(nextState));
}

async function storeCurrentNotificationBaseline(
  ctx: LotideContext,
): Promise<void> {
  const notifications = await LotideService.getNotifications(ctx);
  const ids = notifications.map(notificationFingerprint);
  await setNotificationStateEntry(buildAccountKey(ctx), {
    initialized: true,
    ids,
  });
}

async function readEnabledSetting(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!stored) return false;

  try {
    return JSON.parse(stored) === true;
  } catch {
    return false;
  }
}

function permissionAllowsNotifications(
  permission: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
): boolean {
  return permission.granted || permission.status === "granted";
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(
    NOTIFICATION_CHANNEL_ID,
    {
      name: "Lotide notifications",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    },
  );
}

async function ensureNotificationActivationReady(): Promise<void> {
  await ensureChannel();

  const granted = await requestNotificationPermission();
  if (!granted) {
    throw new Error(
      "Allow notifications in system settings to enable Lotide background alerts.",
    );
  }
}

async function runPollAndNotifyForContext(ctx: LotideContext): Promise<number> {
  const enabled = await readEnabledSetting();
  if (!enabled) return 0;

  const permission = await Notifications.getPermissionsAsync();
  const canNotify = permissionAllowsNotifications(permission);
  if (!canNotify) return 0;

  const accountKey = buildAccountKey(ctx);
  const accountState = await getNotificationStateEntry(accountKey);
  const known = new Set(accountState.ids);
  const notifications = await LotideService.getNotifications(ctx);
  const currentIds = notifications.map(notificationFingerprint);
  const candidates = accountState.initialized
    ? notifications.filter(item => !known.has(notificationFingerprint(item)))
    : notifications.filter(item => item.unseen);

  if (!accountState.initialized && notifications.length === 0) {
    await setNotificationStateEntry(accountKey, {
      initialized: true,
      ids: [],
    });
    return 0;
  }

  if (candidates.length === 0) {
    if (!accountState.initialized) {
      await setNotificationStateEntry(accountKey, {
        initialized: true,
        ids: currentIds,
      });
    }
    return 0;
  }

  const combinedIds = Array.from(new Set([...accountState.ids, ...currentIds]));

  await ensureChannel();
  await Promise.all(
    candidates.map(item =>
      Notifications.scheduleNotificationAsync({
        content: {
          ...notificationContent(item),
          data: notificationData(item, ctx),
        },
        trigger: { channelId: NOTIFICATION_CHANNEL_ID },
      }),
    ),
  );

  const trimmed = combinedIds.slice(-MAX_TRACKED_NOTIFICATION_IDS);
  await setNotificationStateEntry(accountKey, {
    initialized: true,
    ids: trimmed,
  });
  return candidates.length;
}

/* ------------------------------------------------------------------------- */
/* Background Task Registration and Execution                                */
/* ------------------------------------------------------------------------- */

TaskManager.defineTask(POLL_TASK_NAME, async () => {
  try {
    const ctx = await StorageService.lotideContext.query();
    if (!ctx?.login) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    await runPollAndNotifyForContext(ctx);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("Lotide notification poll failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerNotificationPollTask(
  options: NotificationPollTaskRegistrationOptions = {},
): Promise<NotificationPollTaskRegistrationResult> {
  if (Platform.OS !== "android") return "skipped";

  const enabled = await readEnabledSetting();
  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(POLL_TASK_NAME);

  if (!enabled) {
    if (alreadyRegistered) {
      await BackgroundTask.unregisterTaskAsync(POLL_TASK_NAME);
      return "unregistered";
    }
    return "unchanged";
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    if (options.requireAvailable) {
      throw new Error(
        "Background notification tasks are not available on this device.",
      );
    }

    return "unavailable";
  }

  if (alreadyRegistered) {
    await BackgroundTask.unregisterTaskAsync(POLL_TASK_NAME);
  }

  await BackgroundTask.registerTaskAsync(POLL_TASK_NAME, {
    minimumInterval: POLL_INTERVAL_MINUTES,
  });
  return "registered";
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (permissionAllowsNotifications(existing)) {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync(
    Platform.OS === "android" ? { android: {} } : undefined,
  );
  return permissionAllowsNotifications(next);
}

export async function getNotificationEnabled(): Promise<boolean> {
  return readEnabledSetting();
}

export async function setNotificationEnabled(
  enabled: boolean,
  ctx?: LotideContext,
): Promise<void> {
  if (!enabled) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(false));
    await registerNotificationPollTask();
    return;
  }

  if (!ctx?.login) {
    throw new Error("Sign in before enabling Lotide notifications.");
  }

  await ensureNotificationActivationReady();

  await storeCurrentNotificationBaseline(ctx);

  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(true));

  try {
    await registerNotificationPollTask({ requireAvailable: true });
  } catch (error) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(false));
    throw error;
  }
}

export async function pollNotificationsNow(ctx: LotideContext): Promise<number> {
  if (Platform.OS !== "android") {
    return 0;
  }

  return runPollAndNotifyForContext(ctx);
}

/* end of LotideNotificationPoller.ts */
