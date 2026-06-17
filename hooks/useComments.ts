/*
    Project: Hoot Mobile
    -------------------

    File: useComments.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/reduxStore";
import { useLotideCtx } from "./useLotideCtx";
import * as LotideService from "../services/LotideService";
import { editComment, setCommentMulti } from "../slices/commentSlice";
import { editPost } from "../slices/postSlice";

/**
 * Gets child comment IDs
 */
export default function useComments(
  type: ContentType,
  id: number,
): {
  comments?: Paged<CommentId>;
  isLoading: boolean;
  loadError: string;
  loadNextPage: () => void;
} {
  const dispatch = useDispatch();
  const comments = useSelector(
    (state: RootState) =>
      type === "post"
        ? state.posts.posts[id]?.replies
        : state.comments.comments[id]?.replies,
  ) as Paged<CommentId> | undefined;
  const ctx = useLotideCtx();
  const shouldLoadOnMount = type === "post" && !comments;
  const loadKey = `${type}:${id}`;
  const initialLoadKey = useRef<string | null>(null);
  const [loadErrorState, setLoadErrorState] = useState({
    key: "",
    message: "",
  });
  const loadError =
    loadErrorState.key === loadKey ? loadErrorState.message : "";
  const isLoading = !comments && loadError === "";

  const loadNextPage = useCallback(() => {
    if (!ctx) return;
    if (comments && comments.next_page === null) return;

    const nextPage = comments?.next_page ?? undefined;

    switch (type) {
      case "post":
        LotideService.getPostComments(ctx, id, nextPage).then(newComments => {
          dispatch(setCommentMulti(newComments[1]));
          dispatch(
            editPost({
              id,
              post: {
                replies: {
                  items: [...(comments?.items || []), ...(newComments[0]?.items || [])],
                  next_page: newComments[0]?.next_page || null,
                },
              },
            }),
          );
          setLoadErrorState({ key: loadKey, message: "" });
        }).catch(() => {
          setLoadErrorState({ key: loadKey, message: "Cannot load comments" });
        });
        break;
      case "comment":
        LotideService.getCommentComments(ctx, id, nextPage).then(newComments => {
          dispatch(setCommentMulti(newComments[1]));
          dispatch(
            editComment({
              id,
              comment: {
                replies: {
                  items: [...(comments?.items || []), ...(newComments[0]?.items || [])],
                  next_page: newComments[0]?.next_page || null,
                },
              },
            }),
          );
          setLoadErrorState({ key: loadKey, message: "" });
        }).catch(() => {
          setLoadErrorState({ key: loadKey, message: "Cannot load comments" });
        });
        break;
    }
  }, [ctx, comments, dispatch, id, loadKey, type]);

  useEffect(() => {
    if (ctx && shouldLoadOnMount && initialLoadKey.current !== loadKey) {
      initialLoadKey.current = loadKey;
      loadNextPage();
    }
  }, [ctx, loadKey, loadNextPage, shouldLoadOnMount]);

  return {
    comments,
    isLoading,
    loadError,
    loadNextPage,
  };
}

/* end of useComments.ts */
