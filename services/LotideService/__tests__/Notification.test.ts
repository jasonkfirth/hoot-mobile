/*
    Project: Hoot Mobile
    -------------------

    File: Notification.test.ts

    Purpose:

        Validate Lotide notification service normalization for Lotide's
        typed notification API responses.

    Responsibilities:

        • Verify Lotide notification variants become mobile notification data
        • Verify legacy notification shapes still work
        • Verify unknown and malformed notifications are ignored safely

    This file intentionally does NOT contain:

        • React component rendering tests
        • Live network integration tests
        • Push notification behavior
*/

import {
  getNotifications,
  normalizeNotificationList,
  transformToFullNotification,
} from "../Notification";

describe("transformToFullNotification", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("transforms Lotide post reply notifications", () => {
    const out = transformToFullNotification({
      type: "post_reply",
      unseen: true,
      reply: {
        id: 44,
      },
      post: {
        id: 13,
      },
    });

    expect(out).toEqual({
      unseen: true,
      commentId: 44,
      origin: {
        type: "post",
        id: 13,
      },
      postId: 13,
    });
  });

  test("transforms Lotide comment reply notifications", () => {
    const out = transformToFullNotification({
      type: "comment_reply",
      unseen: false,
      reply: {
        id: 45,
      },
      comment: {
        id: 44,
      },
      post: {
        id: 13,
      },
    });

    expect(out).toEqual({
      unseen: false,
      commentId: 45,
      origin: {
        type: "comment",
        id: 44,
      },
      postId: 13,
    });
  });

  test("transforms Lotide comment mention notifications", () => {
    const out = transformToFullNotification({
      type: "comment_mention",
      unseen: true,
      comment: {
        id: 45,
      },
      post: {
        id: 13,
      },
    });

    expect(out).toEqual({
      unseen: true,
      commentId: 45,
      origin: {
        type: "comment",
        id: 45,
      },
      postId: 13,
    });
  });

  test("transforms legacy post-only notifications to post origin events", () => {
    const out = transformToFullNotification({
      unseen: false,
      post: {
        id: 13,
      },
      comment: undefined,
    });

    expect(out).toEqual({
      unseen: false,
      commentId: 13,
      origin: {
        type: "post",
        id: 13,
      },
      postId: 13,
    });
  });

  test("transforms legacy comment notifications to comment origin events", () => {
    const out = transformToFullNotification({
      unseen: true,
      post: {
        id: 13,
      },
      comment: {
        id: 44,
      },
    });

    expect(out).toEqual({
      unseen: true,
      commentId: 44,
      origin: {
        type: "comment",
        id: 44,
      },
      postId: 13,
    });
  });

  test("supports user follow notifications on Lotide 0.17+", () => {
    const out = transformToFullNotification(
      {
        type: "user_follow",
        unseen: true,
        user: {
          id: 31,
          username: "alice",
          local: false,
          host: "example.com",
          is_bot: false,
        },
      },
      17,
    );

    expect(out).toEqual(
      expect.objectContaining({
        unseen: true,
        kind: "user_follow",
        actor: expect.objectContaining({
          id: 31,
          username: "alice",
          local: false,
          host: "example.com",
          is_bot: false,
        }),
      }),
    );
  });

  test("ignores user follow notifications on pre-0.17 servers", () => {
    const out = transformToFullNotification(
      {
        type: "user_follow",
        unseen: true,
        user: {
          id: 31,
          username: "alice",
          local: false,
          host: "example.com",
          is_bot: false,
        },
      },
      16,
    );

    expect(out).toBeUndefined();
  });

  test("drops unknown and malformed notification entries", () => {
    const out = normalizeNotificationList({
      items: [
        { type: "unknown", unseen: true },
        { type: "post_reply", unseen: true, reply: { id: "bad" }, post: { id: 1 } },
        { type: "post_mention", unseen: false, post: { id: 2 } },
      ],
      next_page: null,
    });

    expect(out).toEqual([
      {
        unseen: false,
        commentId: 2,
        origin: {
          type: "post",
          id: 2,
        },
        postId: 2,
      },
    ]);
  });

  test("accepts legacy raw notification arrays", () => {
    const out = normalizeNotificationList([
      {
        unseen: false,
        post: {
          id: 13,
        },
      },
    ]);

    expect(out).toEqual([
      {
        unseen: false,
        commentId: 13,
        origin: {
          type: "post",
          id: 13,
        },
        postId: 13,
      },
    ]);
  });

  test("loads paged Lotide notification responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: [
          {
            type: "post_mention",
            unseen: true,
            post: { id: 99 },
          },
        ],
        next_page: null,
      }),
    });

    const out = await getNotifications({
      apiUrl: "https://lotide.fbxl.net/api/unstable",
      login: { token: "token-1" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://lotide.fbxl.net/api/unstable/users/~me/notifications",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      }),
    );
    expect(out).toEqual([
      {
        unseen: true,
        commentId: 99,
        origin: {
          type: "post",
          id: 99,
        },
        postId: 99,
      },
    ]);
  });

  test("loads and filters user follow notifications based on server version", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        items: [
          {
            type: "user_follow",
            unseen: false,
            user: {
              id: 44,
              username: "alice",
              local: false,
              host: "example.com",
              is_bot: false,
            },
          },
        ],
        next_page: null,
      }),
    });

    const modern = await getNotifications({
      apiUrl: "https://lotide.fbxl.net/api/unstable",
      apiVersion: 17,
      login: { token: "token-1" },
    });
    const legacy = await getNotifications({
      apiUrl: "https://lotide.fbxl.net/api/unstable",
      apiVersion: 16,
      login: { token: "token-1" },
    });

    expect(modern).toEqual([
      expect.objectContaining({
        kind: "user_follow",
        actor: expect.objectContaining({ id: 44 }),
      }),
    ]);
    expect(legacy).toEqual([]);
  });
});

/* end of Notification.test.ts */
