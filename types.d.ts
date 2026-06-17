/*
    Project: Hoot Mobile
    -------------------

    File: types.d.ts

    Purpose:

        Defines the shared Lotide API shapes used across the application.

    Responsibilities:

        • Provide stable global types for Lotide records
        • Keep API identifiers usable as object keys and route parameters
        • Document nullable response fields that the UI must handle safely

    This file intentionally does NOT contain:

        • Runtime validation logic
        • Endpoint-specific request builders
        • React component props
*/

export {};

declare global {
  type UserId = number;
  type PostId = number;
  type CommentId = number;
  type CommunityId = number;

  type ContentType = "post" | "comment";
  type SortOption = "hot" | "new" | "top";
  type FederationStatus = "unsent" | "sent" | "received" | "posted";

  type Paged<T> = {
    items: T[];
    next_page: string | null;
  };

  type ContentBlock = {
    content_text?: string | null;
    content_markdown?: string | null;
    content_html?: string | null;
  };

  type LotideContent = string | ContentBlock | null | undefined;

  type Avatar = {
    url: string;
  };

  type Profile = {
    id: UserId;
    username: string;
    host: string;
    local?: boolean;
    avatar?: Avatar;
    description?: LotideContent;
    is_bot?: boolean;
    remote_url?: string;
    suspended?: boolean;
    your_note?: ContentBlock;
    [key: string]: unknown;
  };

  type CommunityFollow = {
    accepted: boolean;
    federation_status?: FederationStatus;
    [key: string]: unknown;
  };

  type VisibilitySuppression = {
    server: boolean;
    user: boolean;
  };

  type CommunityLastPost = {
    id: PostId;
    title: string;
    created?: string;
    remote_url?: string;
    sensitive: boolean;
  };

  type Community = {
    id: CommunityId;
    name: string;
    host: string;
    local: boolean;
    description?: LotideContent;
    deleted?: boolean;
    latest_unfollow_status?: FederationStatus;
    last_post?: CommunityLastPost;
    pending_moderation_actions?: number;
    remote_post_count?: number;
    visibility_suppression?: VisibilitySuppression;
    you_are_moderator?: boolean;
    your_follow?: CommunityFollow;
    [key: string]: unknown;
  };

  type Post = {
    id: PostId;
    title: string;
    author?: Profile;
    community?: Community;
    created: string;
    content_text?: string;
    content_markdown?: string;
    content_html?: string;
    federation_status?: FederationStatus;
    href?: string;
    remote_url?: string;
    replies_count_total: number;
    score: number;
    sensitive?: boolean;
    sticky?: boolean;
    your_vote?: boolean | object | null;
    [key: string]: unknown;
  };

  type Comment = {
    id: CommentId;
    author?: Profile;
    attachments?: { url: string }[];
    content_text?: string;
    content_markdown?: string;
    content_html?: string;
    created: string;
    deleted?: boolean;
    federation_status?: FederationStatus;
    local?: boolean;
    remote_url?: string;
    replies?: Paged<CommentId>;
    score: number;
    sensitive?: boolean;
    your_vote?: boolean;
    [key: string]: unknown;
  };

  type NewPost = {
    community: CommunityId;
    title: string;
    content_markdown?: string;
    href?: string;
  };

  type Login = {
    token: string;
    user?: Profile;
    [key: string]: unknown;
  };

  type LotideContext = {
    apiUrl?: string;
    apiVersion?: number;
    login?: Login;
    [key: string]: unknown;
  };

  type InstanceInfo = {
    apiVersion: number;
    description?: LotideContent;
    site_name: string;
    software: {
      name: string;
      version: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  type ReplyNotification = {
    unseen: boolean;
    kind?: "reply";
    commentId: CommentId;
    origin: {
      type: ContentType;
      id: PostId | CommentId;
    };
    postId: PostId;
  };

  type UserFollowNotification = {
    unseen: boolean;
    kind: "user_follow";
    actor?: Profile;
  };

  type FullNotification = ReplyNotification | UserFollowNotification;

  type HrefData = {
    imageUrl?: string;
    isVideo?: boolean;
    linkUrl?: string;
  };

  type HeadersInit = Record<string, string>;

  const document: {
    addEventListener: (
      eventName: string,
      listener: (...args: any[]) => void,
      options?: boolean | unknown,
    ) => void;
  };
}

/* end of types.d.ts */
