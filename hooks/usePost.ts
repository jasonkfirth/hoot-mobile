/*
    Project: Hoot Mobile
    -------------------

    File: usePost.ts

    Purpose:

        Read and refresh a single post from Redux and Lotide.

    Responsibilities:

        - Select cached post data
        - Fetch missing posts
        - Support explicit reload attempts

    This file intentionally does NOT contain:

        - feed pagination
        - comment loading
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
