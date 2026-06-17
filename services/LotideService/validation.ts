/*
    Project: Hoot Mobile
    -------------------

    File: validation.ts

    Purpose:

        Validates and normalizes untrusted Lotide API response payloads
        before the rest of the app uses them.

    Responsibilities:

        • Provide shared runtime type guards for API payloads
        • Normalize paged API responses and skip malformed list items
        • Normalize common Lotide actor, community, post, and comment shapes
        • Produce friendly errors for structurally invalid API responses

    This file intentionally does NOT contain:

        • Fetch or authentication logic
        • React UI state
        • Endpoint-specific request construction
*/

import type { UserThing } from "./User";

/* ------------------------------------------------------------------------- */
/* Errors and Primitive Guards                                               */
/* ------------------------------------------------------------------------- */

export class InvalidLotideResponseError extends Error {
  constructor(context: string) {
    super(`Invalid Lotide API response: ${context}`);
    this.name = "InvalidLotideResponseError";
  }
}

export type Normalizer<T> = (value: unknown) => T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expectRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new InvalidLotideResponseError(context);
  }

  return value;
}

export function expectNumber(
  value: unknown,
  context: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidLotideResponseError(context);
  }

  return value;
}

export function expectString(
  value: unknown,
  context: string,
): string {
  if (typeof value !== "string") {
    throw new InvalidLotideResponseError(context);
  }

  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function optionalFederationStatus(value: unknown): string | undefined {
  return value === "unsent" ||
    value === "sent" ||
    value === "received" ||
    value === "posted"
    ? value
    : undefined;
}

export function normalizeVote(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return false;
  }

  return isRecord(value);
}

/* ------------------------------------------------------------------------- */
/* Paged Responses                                                           */
/* ------------------------------------------------------------------------- */

export function normalizePaged<T>(
  value: unknown,
  itemNormalizer: Normalizer<T>,
  context: string,
): Paged<T> {
  const data = expectRecord(value, context);

  if (!Array.isArray(data.items)) {
    throw new InvalidLotideResponseError(`${context}.items`);
  }

  return {
    items: data.items.flatMap(item => {
      try {
        return [itemNormalizer(item)];
      } catch (error) {
        if (error instanceof InvalidLotideResponseError) {
          return [];
        }

        throw error;
      }
    }),
    next_page:
      typeof data.next_page === "string" || data.next_page === null
        ? data.next_page
        : null,
  };
}

/* ------------------------------------------------------------------------- */
/* Shared Lotide Shapes                                                      */
/* ------------------------------------------------------------------------- */

export function normalizeContent(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return {
      content_text: "",
      content_markdown: null,
      content_html: null,
    };
  }

  return {
    content_text:
      typeof value.content_text === "string" ? value.content_text : null,
    content_markdown:
      typeof value.content_markdown === "string" ? value.content_markdown : null,
    content_html:
      typeof value.content_html === "string" ? value.content_html : null,
  };
}

function normalizeOptionalRecord<T>(
  value: unknown,
  normalizer: Normalizer<T>,
): T | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  try {
    return normalizer(value);
  } catch (error) {
    if (error instanceof InvalidLotideResponseError) {
      return undefined;
    }

    throw error;
  }
}

function normalizeYourFollow(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const federationStatus = optionalFederationStatus(value.federation_status);

  return {
    ...value,
    accepted: optionalBoolean(value.accepted) ?? false,
    federation_status: federationStatus,
  };
}

function normalizeVisibilitySuppression(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    server: optionalBoolean(value.server) ?? false,
    user: optionalBoolean(value.user) ?? false,
  };
}

function normalizeCommunityLastPost(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    ...value,
    id: expectNumber(value.id, "community.last_post.id"),
    title: expectString(value.title, "community.last_post.title"),
    created: optionalString(value.created),
    remote_url: optionalString(value.remote_url),
    sensitive: optionalBoolean(value.sensitive) ?? false,
  };
}

export function normalizeActor(value: unknown): Profile {
  const data = expectRecord(value, "actor");

  return {
    ...data,
    id: expectNumber(data.id, "actor.id"),
    username: expectString(data.username, "actor.username"),
    host: expectString(data.host, "actor.host"),
    avatar: isRecord(data.avatar) && typeof data.avatar.url === "string"
      ? { url: data.avatar.url }
      : undefined,
    local: optionalBoolean(data.local) ?? false,
    is_bot: optionalBoolean(data.is_bot) ?? false,
    remote_url: optionalString(data.remote_url),
  } as Profile;
}

export function normalizeUserProfile(value: unknown): Profile {
  const data = expectRecord(value, "user");
  const actor = normalizeActor(data);

  return {
    ...data,
    ...actor,
    description: normalizeContent(data.description),
    suspended: optionalBoolean(data.suspended),
    your_note: isRecord(data.your_note)
      ? normalizeContent(data.your_note)
      : undefined,
  } as Profile;
}

export function normalizeCommunity(value: unknown): Community {
  const data = expectRecord(value, "community");

  return {
    ...data,
    id: expectNumber(data.id, "community.id"),
    name: expectString(data.name, "community.name"),
    host: expectString(data.host, "community.host"),
    local: optionalBoolean(data.local) ?? false,
    description: normalizeContent(data.description),
    deleted: optionalBoolean(data.deleted) ?? false,
    you_are_moderator: optionalBoolean(data.you_are_moderator),
    your_follow: normalizeYourFollow(data.your_follow),
    last_post: normalizeCommunityLastPost(data.last_post),
    remote_post_count: optionalNumber(data.remote_post_count),
    latest_unfollow_status: optionalFederationStatus(data.latest_unfollow_status),
    visibility_suppression: normalizeVisibilitySuppression(
      data.visibility_suppression,
    ),
    pending_moderation_actions: optionalNumber(data.pending_moderation_actions),
  } as Community;
}

export function normalizePost(value: unknown): Post {
  const data = expectRecord(value, "post");

  return {
    ...data,
    id: expectNumber(data.id, "post.id"),
    title: expectString(data.title, "post.title"),
    author: normalizeOptionalRecord(data.author, normalizeActor),
    community: normalizeOptionalRecord(data.community, normalizeCommunity),
    created: optionalString(data.created) || new Date(0).toISOString(),
    remote_url: optionalString(data.remote_url),
    content_text:
      typeof data.content_text === "string" ? data.content_text : undefined,
    content_markdown:
      typeof data.content_markdown === "string"
        ? data.content_markdown
        : undefined,
    content_html:
      typeof data.content_html === "string" ? data.content_html : undefined,
    href: optionalString(data.href),
    replies_count_total: optionalNumber(data.replies_count_total) ?? 0,
    score: optionalNumber(data.score) ?? 0,
    sticky: optionalBoolean(data.sticky) ?? false,
    sensitive: optionalBoolean(data.sensitive) ?? false,
    federation_status: optionalFederationStatus(data.federation_status),
    your_vote: normalizeVote(data.your_vote),
  } as Post;
}

export type RawComment = Omit<Omit<Comment, "replies">, "your_vote"> & {
  replies?: Paged<RawComment> | null;
  your_vote?: object | boolean | null;
};

export function normalizeComment(value: unknown): RawComment {
  const data = expectRecord(value, "comment");

  return {
    ...data,
    id: expectNumber(data.id, "comment.id"),
    remote_url: optionalString(data.remote_url),
    content_text:
      typeof data.content_text === "string" ? data.content_text : undefined,
    content_markdown:
      typeof data.content_markdown === "string"
        ? data.content_markdown
        : undefined,
    content_html:
      typeof data.content_html === "string" ? data.content_html : undefined,
    author: normalizeOptionalRecord(data.author, normalizeActor),
    created: optionalString(data.created) || new Date(0).toISOString(),
    deleted: optionalBoolean(data.deleted) ?? false,
    local: optionalBoolean(data.local) ?? false,
    score: optionalNumber(data.score) ?? 0,
    sensitive: optionalBoolean(data.sensitive) ?? false,
    attachments: Array.isArray(data.attachments)
      ? data.attachments.flatMap(attachment =>
          isRecord(attachment) && typeof attachment.url === "string"
            ? [{ url: attachment.url }]
            : [],
        )
      : [],
    federation_status: optionalFederationStatus(data.federation_status),
    replies: isRecord(data.replies)
      ? normalizePaged(data.replies, normalizeComment, "comment.replies")
      : undefined,
    your_vote: data.your_vote,
  } as RawComment;
}

export function normalizeSubmittedId(
  value: unknown,
  context: string,
): { id: number } {
  const data = expectRecord(value, context);

  return {
    id: expectNumber(data.id, `${context}.id`),
  };
}

export function normalizeCommunityFlag(value: unknown) {
  const data = expectRecord(value, "flag");
  const rawContent = isRecord(data.content)
    ? normalizeContent(data.content)
    : undefined;
  const content =
    typeof rawContent === "string"
      ? { content_text: rawContent }
      : rawContent;

  return {
    ...data,
    id: expectNumber(data.id, "flag.id"),
    flagger: normalizeOptionalRecord(data.flagger, normalizeActor),
    created_local: optionalString(data.created_local),
    content,
    type: optionalString(data.type),
    post: isRecord(data.post)
      ? {
          id: expectNumber(data.post.id, "flag.post.id"),
          title: expectString(data.post.title, "flag.post.title"),
        }
      : undefined,
  };
}

export function normalizeUserThing(value: unknown): UserThing {
  const data = expectRecord(value, "user thing");
  const type = expectString(data.type, "user thing.type");

  if (type === "post") {
    return {
      ...normalizePost(data),
      type: "post",
    } as UserThing;
  }

  if (type === "comment") {
    const post = expectRecord(data.post, "user thing.post");

    return {
      ...data,
      type: "comment",
      id: expectNumber(data.id, "user thing.id"),
      content_text:
        typeof data.content_text === "string" ? data.content_text : null,
      content_html:
        typeof data.content_html === "string" ? data.content_html : null,
      created: optionalString(data.created),
      post: {
        id: expectNumber(post.id, "user thing.post.id"),
        title: expectString(post.title, "user thing.post.title"),
        remote_url: optionalString(post.remote_url),
        sensitive: optionalBoolean(post.sensitive),
      },
      remote_url: optionalString(data.remote_url),
      sensitive: optionalBoolean(data.sensitive),
    } as UserThing;
  }

  throw new InvalidLotideResponseError("user thing.type");
}

/* end of validation.ts */
