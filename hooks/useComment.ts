/*
    Project: Hoot Mobile
    -------------------

    File: useComment.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
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
        .catch(() => console.log(`Comment ${commentId} could not be loaded`));
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
