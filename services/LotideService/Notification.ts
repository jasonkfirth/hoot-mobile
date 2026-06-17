/*
    Project: Hoot Mobile
    -------------------

    File: Notification.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { lotideRequest, readJson } from "./util";
import { expectNumber, isRecord, normalizeActor } from "./validation";

function supportsUserFollow(apiVersion: number): boolean {
  return apiVersion >= 17;
}

export async function getNotifications(
  ctx: LotideContext,
): Promise<FullNotification[]> {
  return lotideRequest(ctx, "GET", "users/~me/notifications")
    .then(readJson)
    .then(data => normalizeNotificationList(data, ctx.apiVersion ?? 0));
}

export function transformToFullNotification(
  notification: unknown,
  apiVersion = 0,
): FullNotification | undefined {
  if (!isRecord(notification)) {
    return undefined;
  }

  const type = typeof notification.type === "string"
    ? notification.type
    : undefined;
  const post = isRecord(notification.post) ? notification.post : undefined;
  const reply = isRecord(notification.reply) ? notification.reply : undefined;
  const comment = isRecord(notification.comment)
    ? notification.comment
    : undefined;
  const user = isRecord(notification.user) ? notification.user : undefined;

  if (type === "post_reply" && post && reply) {
    return {
      unseen: notification.unseen === true,
      commentId: expectNumber(reply.id, "notification.reply.id"),
      origin: {
        type: "post",
        id: expectNumber(post.id, "notification.post.id"),
      },
      postId: expectNumber(post.id, "notification.post.id"),
    };
  }

  if (type === "user_follow" && supportsUserFollow(apiVersion) && user) {
    return {
      unseen: notification.unseen === true,
      kind: "user_follow",
      actor: normalizeActor(user),
    };
  }

  if (type === "post_mention" && post) {
    return {
      unseen: notification.unseen === true,
      commentId: expectNumber(post.id, "notification.post.id"),
      origin: {
        type: "post",
        id: expectNumber(post.id, "notification.post.id"),
      },
      postId: expectNumber(post.id, "notification.post.id"),
    };
  }

  if (type === "comment_reply" && post && reply && comment) {
    return {
      unseen: notification.unseen === true,
      commentId: expectNumber(reply.id, "notification.reply.id"),
      origin: {
        type: "comment",
        id: expectNumber(comment.id, "notification.comment.id"),
      },
      postId: expectNumber(post.id, "notification.post.id"),
    };
  }

  if (type === "comment_mention" && post && comment) {
    return {
      unseen: notification.unseen === true,
      commentId: expectNumber(comment.id, "notification.comment.id"),
      origin: {
        type: "comment",
        id: expectNumber(comment.id, "notification.comment.id"),
      },
      postId: expectNumber(post.id, "notification.post.id"),
    };
  }

  if (post) {
    const legacyCommentId = isRecord(notification.comment)
      ? notification.comment.id
      : undefined;
    const postId = expectNumber(post.id, "notification.post.id");

    if (legacyCommentId === undefined) {
      return {
        unseen: notification.unseen === true,
        commentId: postId,
        origin: { type: "post", id: postId },
        postId,
      };
    }

    return {
      unseen: notification.unseen === true,
      commentId: expectNumber(legacyCommentId, "notification.comment.id"),
      origin: {
        type: "comment",
        id: expectNumber(legacyCommentId, "notification.comment.id"),
      },
      postId,
    };
  }

  return undefined;
}

export function normalizeNotificationList(
  data: unknown,
  apiVersion = 0,
): FullNotification[] {
  const rawItems = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
    ? data.items
    : [];

  return rawItems.flatMap(item => {
    try {
      const notification = transformToFullNotification(item, apiVersion);
      return notification ? [notification] : [];
    } catch {
      return [];
    }
  });
}

/* end of Notification.ts */
