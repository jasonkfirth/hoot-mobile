/*
    Project: Hoot Mobile
    -------------------

    File: usePost.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/reduxStore";
import * as LotideService from "../services/LotideService";
import { useLotideCtx } from "./useLotideCtx";
import { setPost } from "../slices/postSlice";

export default function usePost(
  postId: PostId,
  reloadId = 0,
): Post | undefined {
  const dispatch = useDispatch();
  const ctx = useLotideCtx();
  const post: Post | undefined = useSelector(
    (state: RootState) => state.posts.posts[postId],
  );

  useEffect(() => {
    if (!ctx) return;
    if (!post) {
      LotideService.getPost(ctx, postId)
        .then(post => {
          dispatch(setPost({ post }));
        })
        .catch(() => null);
    }
  }, [ctx, dispatch, post, postId, reloadId]);

  return post;
}

/* end of usePost.ts */
