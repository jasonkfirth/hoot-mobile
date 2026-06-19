/*
    Project: Hoot Mobile
    -------------------

    File: useVote.ts

    Purpose:

        Manage optimistic post and comment voting.

    Responsibilities:

        - Determine current vote state
        - Apply and remove votes through Lotide
        - Update Redux score state optimistically

    This file intentionally does NOT contain:

        - vote button presentation
        - authentication prompts
*/

import { useDispatch } from "react-redux";
import { Alert } from "react-native";
import { setPostVote } from "../slices/postSlice";
import { AppDispatch } from "../store/reduxStore";
import * as LotideService from "../services/LotideService";
import { useLotideCtx } from "./useLotideCtx";
import { setCommentVote } from "../slices/commentSlice";
import { getErrorMessage } from "../utils/error";

export default function useVote(type: ContentType, content: Post | Comment) {
  const isUpvoted = !!content.your_vote;
  const dispatch = useDispatch<AppDispatch>();
  const ctx = useLotideCtx();

  function dispatchVote(vote: boolean) {
    if (type === "post") {
      dispatch(setPostVote({ id: content.id, vote }));
    } else {
      dispatch(setCommentVote({ id: content.id, vote }));
    }
  }

  function addVote() {
    if (!ctx?.login) return;
    if (type === "post") {
      LotideService.applyVote(ctx, content.id)
        .then(() => dispatchVote(true))
        .catch(error => {
          Alert.alert("Vote failed", getErrorMessage(error));
        });
    } else {
      LotideService.applyCommentVote(ctx, content.id)
        .then(() => dispatchVote(true))
        .catch(error => {
          Alert.alert("Vote failed", getErrorMessage(error));
        });
    }
  }

  function removeVote() {
    if (!ctx?.login) return;
    if (type === "post") {
      LotideService.removeVote(ctx, content.id)
        .then(() => dispatchVote(false))
        .catch(error => {
          Alert.alert("Vote failed", getErrorMessage(error));
        });
    } else {
      LotideService.removeCommentVote(ctx, content.id)
        .then(() => dispatchVote(false))
        .catch(error => {
          Alert.alert("Vote failed", getErrorMessage(error));
        });
    }
  }

  return {
    isUpvoted,
    addVote,
    removeVote,
  };
}

/* end of useVote.ts */
