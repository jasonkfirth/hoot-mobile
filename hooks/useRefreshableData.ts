/*
    Project: Hoot Mobile
    -------------------

    File: useRefreshableData.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
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
