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
const NOTIFICATION_CHANNEL_ID = "lotide-notifications";
const MAX_TRACKED_NOTIFICATION_IDS = 250;

type NotificationState = {
  [accountKey: string]: string[];
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

  return `reply:${notification.origin.type}:${notification.postId}:${notification.commentId}:${notification.origin.id}`;
}

function notificationContent(notification: FullNotification) {
  if (notification.kind === "user_follow") {
    const actor = notification.actor?.username ?? "Someone";
    return {
      title: "New Lotide follower",
      body: `${actor} followed you`,
    };
  }

  const isComment = notification.origin.type === "comment";
  return {
    title: isComment
      ? "New Lotide comment reply"
      : "New Lotide post reply",
    body: "Open the app to view your latest notifications.",
  };
}

function notificationData(notification: FullNotification): Record<string, unknown> {
  if (notification.kind === "user_follow") {
    return {
      lotideKind: notification.kind,
      lotideActorId: notification.actor?.id,
    };
  }

  return {
    lotidePostId: notification.postId,
    lotideCommentId: notification.commentId,
    lotideKind: notification.kind ?? "reply",
    lotideOriginType: notification.origin.type,
  };
}

async function loadNotificationState(): Promise<NotificationState> {
  const stored = await AsyncStorage.getItem(STATE_KEY);
  const raw = parseJsonObject(stored);
  const out: NotificationState = {};

  Object.keys(raw).forEach(key => {
    const list = raw[key];
    if (Array.isArray(list)) {
      out[key] = list.filter(
        (value: unknown): value is string => typeof value === "string",
      );
    }
  });

  return out;
}

async function getKnownNotificationIds(accountKey: string): Promise<Set<string>> {
  const state = await loadNotificationState();
  return new Set(state[accountKey] ?? []);
}

async function setKnownNotificationIds(
  accountKey: string,
  ids: string[],
): Promise<void> {
  const state = await loadNotificationState();
  const nextState = {
    ...state,
    [accountKey]: ids,
  };

  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(nextState));
}

async function storeCurrentNotificationBaseline(
  ctx: LotideContext,
): Promise<void> {
  const notifications = await LotideService.getNotifications(ctx);
  const ids = notifications.map(notificationFingerprint);
  await setKnownNotificationIds(buildAccountKey(ctx), ids);
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

async function ensureChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(
    NOTIFICATION_CHANNEL_ID,
    {
      name: "Lotide notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    },
  );
}

async function runPollAndNotifyForContext(ctx: LotideContext): Promise<number> {
  const enabled = await readEnabledSetting();
  if (!enabled) return 0;

  const permission = await Notifications.getPermissionsAsync();
  const canNotify = permission.granted || permission.status === "granted";
  if (!canNotify) return 0;

  const notifications = await LotideService.getNotifications(ctx);
  if (notifications.length === 0) return 0;

  const accountKey = buildAccountKey(ctx);
  const known = await getKnownNotificationIds(accountKey);
  const currentIds = notifications.map(notificationFingerprint);
  const candidates = known.size === 0
    ? notifications.filter(item => item.unseen)
    : notifications.filter(item => !known.has(notificationFingerprint(item)));

  if (candidates.length === 0) {
    if (known.size === 0) {
      await setKnownNotificationIds(accountKey, currentIds);
    }
    return 0;
  }

  const combinedIds = Array.from(new Set([...known, ...currentIds]));

  await ensureChannel();
  await Promise.all(
    candidates.map(item =>
      Notifications.scheduleNotificationAsync({
        content: {
          ...notificationContent(item),
          data: notificationData(item),
        },
        trigger: { channelId: NOTIFICATION_CHANNEL_ID },
      }),
    ),
  );

  const trimmed = combinedIds.slice(-MAX_TRACKED_NOTIFICATION_IDS);
  await setKnownNotificationIds(accountKey, trimmed);
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

export async function registerNotificationPollTask() {
  if (Platform.OS !== "android") return;

  const enabled = await readEnabledSetting();
  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(POLL_TASK_NAME);

  if (!enabled) {
    if (alreadyRegistered) {
      await BackgroundTask.unregisterTaskAsync(POLL_TASK_NAME);
    }
    return;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return;
  }

  if (alreadyRegistered) {
    await BackgroundTask.unregisterTaskAsync(POLL_TASK_NAME);
  }

  await BackgroundTask.registerTaskAsync(POLL_TASK_NAME, {
    minimumInterval: POLL_INTERVAL_MINUTES,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.status === "granted") {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync();
  return next.granted || next.status === "granted";
}

export async function getNotificationEnabled(): Promise<boolean> {
  return readEnabledSetting();
}

export async function setNotificationEnabled(
  enabled: boolean,
  ctx?: LotideContext,
): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(enabled));

  if (enabled && ctx?.login) {
    await storeCurrentNotificationBaseline(ctx);
  }

  await registerNotificationPollTask();
}

export async function pollNotificationsNow(ctx: LotideContext): Promise<number> {
  if (Platform.OS !== "android") {
    return 0;
  }

  return runPollAndNotifyForContext(ctx);
}

/* end of LotideNotificationPoller.ts */
