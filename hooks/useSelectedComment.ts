/*
    Project: Hoot Mobile
    -------------------

    File: useSelectedComment.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useDispatch, useSelector } from "react-redux";
import { setSelectedComment } from "../slices/commentSlice";
import { RootState } from "../store/reduxStore";

export default function useSelectedComment(): [
  CommentId | undefined,
  (id?: CommentId) => void,
] {
  const dispatch = useDispatch();

  const selectedComment = useSelector(
    (state: RootState) => state.comments.selectedComment,
  );

  function set(id?: CommentId) {
    dispatch(setSelectedComment(id));
  }

  return [selectedComment, set];
}

/* end of useSelectedComment.ts */
