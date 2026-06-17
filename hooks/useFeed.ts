/*
    Project: Hoot Mobile
    -------------------

    File: useFeed.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useEffect, useState } from "react";
import { useLotideCtx } from "./useLotideCtx";
import * as LotideService from "../services/LotideService";
import { useDispatch } from "react-redux";
import { setPostMulti } from "../slices/postSlice";

export type UseFeedParams = {
  sort?: SortOption;
  inYourFollows?: boolean;
  communityId?: CommunityId;
  enabled?: boolean;
};

export default function useFeed(
  params: UseFeedParams,
): [PostId[], () => void, () => void, string] {
  const dispatch = useDispatch();
  const ctx = useLotideCtx();
  const [postIds, setPostIds] = useState<PostId[]>([]);
  const [page, setPage] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [resetId, setResetId] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!ctx) return;
    if (params.enabled === false) return;
    LotideService.getPosts(
      ctx,
      page,
      params.sort,
      params.inYourFollows,
      params.communityId,
    ).then(posts => {
      dispatch(setPostMulti({ posts: posts.items }));
      setPostIds(ids => [...ids, ...posts.items.map(p => p.id)]);
      setNextPage(posts.next_page);
      setLoadError("");
    }).catch(() => {
      setNextPage(null);
      setLoadError("Cannot load posts");
    });
  }, [
    ctx,
    dispatch,
    params.enabled,
    page,
    params.communityId,
    params.inYourFollows,
    params.sort,
    resetId,
  ]);

  function loadNextPage() {
    if (nextPage === null) return;
    setPage(nextPage);
    setNextPage(null);
  }

  function reset() {
    setPostIds([]);
    setPage(null);
    setNextPage(null);
    setLoadError("");
    setResetId(x => x + 1);
  }

  return [postIds, loadNextPage, reset, loadError];
}

/* end of useFeed.ts */
