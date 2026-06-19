/*
    Project: Hoot Mobile
    -------------------

    File: useComment.ts

    Purpose:

        Read and refresh a single comment from Redux and Lotide.

    Responsibilities:

        - Select cached comment data
        - Fetch missing comments
        - Support explicit reload attempts

    This file intentionally does NOT contain:

        - comment child pagination
        - post fetching
*/

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/reduxStore";
import { useLotideCtx } from "./useLotideCtx";
import * as LotideService from "../services/LotideService";
import { setCommentMulti } from "../slices/commentSlice";

/**
 * Gets a single comment
 *
 * For child comments, see useComments
 */
export default function useComment(
  commentId?: CommentId,
  reloadId = 0,
): Comment | undefined {
  const dispatch = useDispatch();
  const comment: Comment | undefined = useSelector((state: RootState) =>
    commentId ? state.comments.comments[commentId] : undefined,
  );
  const ctx = useLotideCtx();

  useEffect(() => {
    if (!ctx) return;
    if (!commentId) return;
    if (!comment) {
      LotideService.getComment(ctx, commentId)
        .then(comments => {
          dispatch(setCommentMulti(comments));
        })
        .catch(() => undefined);
    }
  }, [comment, commentId, ctx, dispatch, reloadId]);

  return (
    comment && {
      ...comment,
      replies: undefined,
    }
  );
}

/* end of useComment.ts */
