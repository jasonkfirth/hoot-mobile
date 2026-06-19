/*
    Project: Hoot Mobile
    -------------------

    File: LotideNotificationPoller.test.ts

    Purpose:

        Validate the local mobile notification polling policy.

    Responsibilities:

        - Verify enabling notifications creates a local baseline
        - Verify mobile notifications do not depend only on Lotide's
          globally consumed unseen flag
        - Verify first-run polling does not alert for old notification history

    This file intentionally does NOT contain:

        - Native scheduler integration tests
        - Live Lotide network tests
        - React component rendering tests
*/

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import * as LotideService from "../LotideService";
import {
  getNotificationNavigationTarget,
  getNotificationNavigationTargetFromResponse,
  pollNotificationsNow,
  setNotificationEnabled,
} from "../LotideNotificationPoller";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      __store: store,
      getItem: jest.fn((key: string) =>
        Promise.resolve(store.has(key) ? store.get(key) || null : null),
      ),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("../LotideService", () => ({
  __esModule: true,
  getPrivateMessagePartner: jest.fn((message: PrivateMessage, loginUserId?: UserId) =>
    message.author.id === loginUserId ? message.recipient : message.author,
  ),
  getNotifications: jest.fn(),
}));

const mockGetNotifications = LotideService.getNotifications as jest.Mock;
const mockGetBackgroundTaskStatus = BackgroundTask.getStatusAsync as jest.Mock;
const mockRegisterTask = BackgroundTask.registerTaskAsync as jest.Mock;
const mockIsTaskRegistered = TaskManager.isTaskRegisteredAsync as jest.Mock;
const mockScheduleNotification =
  Notifications.scheduleNotificationAsync as jest.Mock;
const mockSetNotificationChannel =
  Notifications.setNotificationChannelAsync as jest.Mock;
const mockGetNotificationPermissions =
  Notifications.getPermissionsAsync as jest.Mock;
const mockRequestNotificationPermissions =
  Notifications.requestPermissionsAsync as jest.Mock;

const notificationChannelId = "lotide-notifications-v2";

const ctx: LotideContext = {
  apiUrl: "https://lotide.fbxl.net/api/unstable",
  login: {
    token: "token-1",
    user: {
      id: 1,
      username: "sj_zero",
      host: "lotide.fbxl.net",
      local: true,
    },
  },
};

function replyNotification(
  postId: PostId,
  commentId: CommentId,
  unseen: boolean,
): ReplyNotification {
  return {
    unseen,
    commentId,
    origin: {
      type: "post",
      id: postId,
    },
    postId,
  };
}

function privateMessageNotification(): PrivateMessageNotification {
  return {
    unseen: true,
    kind: "private_message",
    message: {
      id: 33,
      author: {
        id: 2,
        username: "remote",
        local: false,
        host: "remote.example",
      },
      recipient: {
        id: 1,
        username: "sj_zero",
        local: true,
        host: "lotide.fbxl.net",
      },
      created: "2026-06-18T12:00:00Z",
      local: false,
      content_text: "hello",
      content_markdown: null,
      content_html: "<p>hello</p>",
      in_reply_to: null,
      sensitive: false,
    },
  };
}

describe("LotideNotificationPoller", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as unknown as { __store: Map<string, string> }).__store.clear();
    mockGetBackgroundTaskStatus.mockResolvedValue(
      BackgroundTask.BackgroundTaskStatus.Available,
    );
    mockIsTaskRegistered.mockResolvedValue(false);
    mockGetNotifications.mockResolvedValue([]);
    mockGetNotificationPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });
    mockRequestNotificationPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });
  });

  test("creates a notification baseline when notifications are enabled", async () => {
    mockGetNotifications.mockResolvedValue([
      replyNotification(10, 20, false),
    ]);

    await setNotificationEnabled(true, ctx);

    expect(mockGetNotifications).toHaveBeenCalledWith(ctx);
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  test("requests OS notification permission while enabling notifications", async () => {
    mockGetNotificationPermissions.mockResolvedValue({
      granted: false,
      status: "undetermined",
    });
    mockRequestNotificationPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });

    await setNotificationEnabled(true, ctx);

    expect(mockRequestNotificationPermissions).toHaveBeenCalledWith({
      android: {},
    });
    await expect(
      AsyncStorage.getItem("@lotide_notification_background_enabled"),
    ).resolves.toBe(JSON.stringify(true));
  });

  test("notifies for a phone-new item even when another client cleared unseen", async () => {
    mockGetNotifications.mockResolvedValue([
      replyNotification(10, 20, false),
    ]);
    await setNotificationEnabled(true, ctx);

    mockScheduleNotification.mockClear();
    mockGetNotifications.mockResolvedValue([
      replyNotification(11, 21, false),
      replyNotification(10, 20, false),
    ]);

    const count = await pollNotificationsNow(ctx);

    expect(count).toBe(1);
    expect(mockScheduleNotification).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({
            lotidePostId: 11,
            lotideCommentId: 21,
          }),
        }),
      }),
    );
  });

  test("notifies for a phone-new item after an intentionally empty baseline", async () => {
    mockGetNotifications.mockResolvedValue([]);
    await setNotificationEnabled(true, ctx);

    mockScheduleNotification.mockClear();
    mockGetNotifications.mockResolvedValue([
      replyNotification(11, 21, false),
    ]);

    const count = await pollNotificationsNow(ctx);

    expect(count).toBe(1);
    expect(mockSetNotificationChannel).toHaveBeenCalledWith(
      notificationChannelId,
      expect.objectContaining({
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      }),
    );
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          sound: "default",
          data: expect.objectContaining({
            lotidePostId: 11,
            lotideCommentId: 21,
          }),
        }),
        trigger: { channelId: notificationChannelId },
      }),
    );
  });

  test("routes private message notifications to the conversation thread", async () => {
    mockGetNotifications.mockResolvedValue([]);
    await setNotificationEnabled(true, ctx);

    mockScheduleNotification.mockClear();
    mockGetNotifications.mockResolvedValue([
      privateMessageNotification(),
    ]);

    const count = await pollNotificationsNow(ctx);

    expect(count).toBe(1);
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "New Lotide message",
          data: expect.objectContaining({
            lotideKind: "private_message",
            lotideMessageId: 33,
            lotidePartnerId: 2,
            lotidePartnerUsername: "remote",
          }),
        }),
      }),
    );
    expect(getNotificationNavigationTarget({
      lotideKind: "private_message",
      lotidePartnerId: 2,
      lotidePartnerUsername: "remote",
    })).toEqual({
      screen: "MessageThread",
      params: {
        userId: 2,
        username: "remote",
      },
    });
  });

  test("does not alert old history on the first poll without a baseline", async () => {
    await AsyncStorage.setItem(
      "@lotide_notification_background_enabled",
      JSON.stringify(true),
    );
    mockScheduleNotification.mockClear();
    mockGetNotifications.mockResolvedValue([
      replyNotification(10, 20, false),
    ]);

    const count = await pollNotificationsNow(ctx);

    expect(count).toBe(0);
    expect(mockScheduleNotification).not.toHaveBeenCalled();

    mockGetNotifications.mockResolvedValue([
      replyNotification(10, 20, false),
    ]);

    await pollNotificationsNow(ctx);

    expect(mockScheduleNotification).not.toHaveBeenCalled();

    mockGetNotifications.mockResolvedValue([
      replyNotification(11, 21, false),
      replyNotification(10, 20, false),
    ]);

    await pollNotificationsNow(ctx);

    expect(mockScheduleNotification).toHaveBeenCalledTimes(1);
  });

  test("does not leave notifications enabled when baseline creation fails", async () => {
    mockGetNotifications.mockRejectedValue(new Error("server unavailable"));

    await expect(setNotificationEnabled(true, ctx)).rejects.toThrow(
      "server unavailable",
    );

    await expect(
      AsyncStorage.getItem("@lotide_notification_background_enabled"),
    ).resolves.toBeNull();
  });

  test("does not leave notifications enabled when task registration is unavailable", async () => {
    mockGetBackgroundTaskStatus.mockResolvedValue(
      BackgroundTask.BackgroundTaskStatus.Restricted,
    );

    await expect(setNotificationEnabled(true, ctx)).rejects.toThrow(
      "not available",
    );

    await expect(
      AsyncStorage.getItem("@lotide_notification_background_enabled"),
    ).resolves.toBe(JSON.stringify(false));
    expect(mockRegisterTask).not.toHaveBeenCalled();
  });

  test("does not enable notifications when OS permission is denied", async () => {
    mockGetNotificationPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    mockRequestNotificationPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });

    await expect(setNotificationEnabled(true, ctx)).rejects.toThrow(
      "Allow notifications",
    );

    expect(mockRequestNotificationPermissions).toHaveBeenCalledWith({
      android: {},
    });
    expect(mockGetNotifications).not.toHaveBeenCalled();
    expect(mockRegisterTask).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem("@lotide_notification_background_enabled"),
    ).resolves.toBeNull();
  });

  test("requires a signed-in context before enabling notifications", async () => {
    await expect(setNotificationEnabled(true)).rejects.toThrow(
      "Sign in before enabling",
    );

    await expect(
      AsyncStorage.getItem("@lotide_notification_background_enabled"),
    ).resolves.toBeNull();
  });

  test("builds post navigation targets from notification data", () => {
    expect(
      getNotificationNavigationTarget({
        lotidePostId: "10",
        lotideCommentId: 20,
      }),
    ).toEqual({
      screen: "Post",
      params: {
        postId: 10,
        highlightedComments: [20],
      },
    });
  });

  test("routes user follow notifications to the notification list", () => {
    expect(
      getNotificationNavigationTarget({
        lotideKind: "user_follow",
        lotideActorId: 5,
      }),
    ).toEqual({
      screen: "Notifications",
    });
  });

  test("ignores non-default notification actions", () => {
    expect(
      getNotificationNavigationTargetFromResponse({
        actionIdentifier: "custom-action",
        notification: {
          request: {
            content: {
              data: {
                lotidePostId: 10,
              },
            },
          },
        },
      } as unknown as Notifications.NotificationResponse),
    ).toBeUndefined();
  });
});

/* end of LotideNotificationPoller.test.ts */
