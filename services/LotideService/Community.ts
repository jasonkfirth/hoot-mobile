/*
    Project: Hoot Mobile
    -------------------

    File: Community.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { lotideRequest, readJson } from "./util";
import {
  expectRecord,
  InvalidLotideResponseError,
  normalizeCommunity,
  normalizeCommunityFlag,
  normalizePaged,
  normalizeSubmittedId,
  normalizeUserProfile,
} from "./validation";

export type CommunityFlag = {
  id: number;
  flagger?: Profile;
  created_local?: string;
  content?: ContentBlock | null;
  type?: string;
  post?: {
    id: PostId;
    title: string;
  };
};

export async function getCommunities(
  ctx: LotideContext,
  onlyFollowing: boolean = false,
  page?: string,
): Promise<Paged<Community>> {
  const scope = onlyFollowing && ctx.login ? "mine" : "everything";
  const query = [
    `scope=${scope}`,
    `include_your=${ctx.login ? "true" : "false"}`,
    "limit=150",
    onlyFollowing && ctx.login ? "your_follow.accepted=true" : undefined,
    "sort=alphabetic",
    page ? getCommunityPageQuery(page) : undefined,
  ]
    .filter(Boolean)
    .join("&");

  return lotideRequest(
    ctx,
    "GET",
    `communities?${query}`,
    undefined,
    !ctx.login,
  )
    .then(readJson)
    .then(data => normalizePaged(data, normalizeCommunity, "communities"));
}

function getCommunityPageQuery(page: string): string {
  if (/^[1-9][0-9]*$/.test(page)) {
    return `page_number=${page}`;
  }

  return `page=${encodeURIComponent(page)}`;
}

export async function getCommunity(
  ctx: LotideContext,
  communityId: CommunityId,
): Promise<Community> {
  return lotideRequest(
    ctx,
    "GET",
    `communities/${communityId}${ctx.login ? "?include_your=true" : ""}`,
    undefined,
    true,
  )
    .then(readJson)
    .then(normalizeCommunity);
}

export async function getUserData(ctx: LotideContext, userId: number) {
  return lotideRequest(
    ctx,
    "GET",
    `users/${userId}${ctx.login ? "?include_your=true" : ""}`,
    undefined,
    true,
  )
    .then(readJson)
    .then(normalizeUserProfile);
}

export async function getModeratedCommunities(
  ctx: LotideContext,
): Promise<Paged<Community>> {
  return lotideRequest(
    ctx,
    "GET",
    "communities?you_are_moderator=true&include_your=true",
  )
    .then(readJson)
    .then(data =>
      normalizePaged(data, normalizeCommunity, "moderated communities"),
    );
}

export async function getCommunityFlags(
  ctx: LotideContext,
  communityId: CommunityId,
): Promise<Paged<CommunityFlag>> {
  return lotideRequest(
    ctx,
    "GET",
    `flags?to_community=${communityId}&dismissed=false`,
  )
    .then(readJson)
    .then(data => normalizePaged(data, normalizeCommunityFlag, "community flags"));
}

export async function dismissCommunityFlag(
  ctx: LotideContext,
  flagId: number,
) {
  return lotideRequest(ctx, "PATCH", `flags/${flagId}`, {
    community_dismissed: true,
  });
}

export async function followCommunity(
  ctx: LotideContext,
  communityId: number,
): Promise<{ accepted: boolean }> {
  return lotideRequest(ctx, "POST", `communities/${communityId}/follow`, {
    try_wait_for_accept: true,
  })
    .then(readJson)
    .then(data => {
      const follow = expectRecord(data, "community follow");

      if (typeof follow.accepted !== "boolean") {
        throw new InvalidLotideResponseError("community follow.accepted");
      }

      return {
        accepted: follow.accepted,
      };
    });
}

export async function unfollowCommunity(
  ctx: LotideContext,
  communityId: number,
) {
  return lotideRequest(ctx, "POST", `communities/${communityId}/unfollow`);
}

export async function newCommunity(
  ctx: LotideContext,
  name: string,
): Promise<{ community: { id: CommunityId } }> {
  return lotideRequest(ctx, "POST", "communities", { name })
    .then(readJson)
    .then(data => {
      if (
        typeof data === "object" &&
        data !== null &&
        "community" in data &&
        typeof data.community === "object" &&
        data.community !== null
      ) {
        return {
          community: normalizeSubmittedId(data.community, "new community"),
        };
      }

      return {
        community: normalizeSubmittedId(data, "new community"),
      };
    });
}

export async function editCommunity(
  ctx: LotideContext,
  id: CommunityId,
  description: string,
) {
  return lotideRequest(ctx, "PATCH", `communities/${id}`, {
    description_markdown: description,
  });
}

/* end of Community.ts */
