/*
    Project: Hoot Mobile
    -------------------

    File: useRefreshableData.ts

    Purpose:

        Coordinate pull-to-refresh style loading state.

    Responsibilities:

        - Track refresh requests
        - Protect state updates after unmount
        - Expose a reusable refreshing flag

    This file intentionally does NOT contain:

        - screen-specific API calls
        - Redux storage
*/

import { useState, useEffect, useRef } from "react";

export function useRefreshableData(
  effect: (stopLoading: () => void) => void | (() => void | undefined),
  deps: unknown[],
): [boolean, () => void] {
  const [refreshCount, setRefreshCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const depsKey = JSON.stringify(deps);
  const effectRef = useRef(effect);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    let isActive = true;
    effectRef.current(() => {
      if (isActive) setIsLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, [refreshCount, depsKey]);

  function refresh() {
    setRefreshCount(c => c + 1);
    setIsLoading(true);
  }

  return [isLoading, refresh];
}

/* end of useRefreshableData.ts */
