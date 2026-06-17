/*
    Project: Hoot Mobile
    -------------------

    File: useLotideCtx.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useSelector } from "react-redux";
import { RootState } from "../store/reduxStore";

export function useLotideCtx() {
  const ctx = useSelector((state: RootState) => state.lotide.ctx);
  return ctx;
}

/* end of useLotideCtx.ts */
