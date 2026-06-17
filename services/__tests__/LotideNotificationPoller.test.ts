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
import * as Notifications from "expo-notifications";

import * as LotideService from "../LotideService";
import {
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
  getNotifications: jest.fn(),
}));

const mockGetNotifications = LotideService.getNotifications as jest.Mock;
const mockScheduleNotification =
  Notifications.scheduleNotificationAsync as jest.Mock;

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
    mockGetNotifications.mockResolvedValue([]);
  });

  test("creates a notification baseline when notifications are enabled", async () => {
    mockGetNotifications.mockResolvedValue([
      replyNotification(10, 20, false),
    ]);

    await setNotificationEnabled(true, ctx);

    expect(mockGetNotifications).toHaveBeenCalledWith(ctx);
    expect(mockScheduleNotification).not.toHaveBeenCalled();
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

  test("does not alert old history on the first poll without a baseline", async () => {
    await setNotificationEnabled(true);
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
  });
});

/* end of LotideNotificationPoller.test.ts */
