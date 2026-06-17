/*
    Project: Hoot Mobile
    -------------------

    File: Hoverable.tsx

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { canUseDOM } from "fbjs/lib/ExecutionEnvironment";

let isEnabled = false;

if (canUseDOM) {
  /**
   * Web browsers emulate mouse events (and hover states) after touch events.
   * This code infers when the currently-in-use modality supports hover
   * (including for multi-modality devices) and considers "hover" to be enabled
   * if a mouse movement occurs more than 1 second after the last touch event.
   * This threshold is long enough to account for longer delays between the
   * browser firing touch and mouse events on low-powered devices.
   */
  const HOVER_THRESHOLD_MS = 1000;
  let lastTouchTimestamp = 0;

  function enableHover() {
    if (isEnabled || Date.now() - lastTouchTimestamp < HOVER_THRESHOLD_MS) {
      return;
    }
    isEnabled = true;
  }

  function disableHover() {
    lastTouchTimestamp = Date.now();
    if (isEnabled) {
      isEnabled = false;
    }
  }

  document.addEventListener("touchstart", disableHover, true);
  document.addEventListener("touchmove", disableHover, true);
  document.addEventListener("mousemove", enableHover, true);
}

function isHoverEnabled(): boolean {
  return isEnabled;
}

export interface HoverableProps {
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
}

export default function Hoverable({
  onHoverIn,
  onHoverOut,
  children,
  onPressIn,
  onPressOut,
}: HoverableProps) {
  const [showHover, setShowHover] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const wasHovered = useRef(false);
  const pressIn = useRef(onPressIn);
  const pressOut = useRef(onPressOut);

  useEffect(() => {
    pressIn.current = onPressIn;
    pressOut.current = onPressOut;
  }, [onHoverOut, onPressIn, onPressOut]);

  useEffect(() => {
    const shouldShowHover = Platform.OS === "web" && showHover && isHovered;
    if (shouldShowHover !== wasHovered.current) {
      if (shouldShowHover && onHoverIn) {
        onHoverIn();
      } else if (!shouldShowHover && onHoverOut) {
        onHoverOut();
      }
      wasHovered.current = shouldShowHover;
    }
  }, [showHover, isHovered, onHoverIn, onHoverOut]);

  const handleMouseEnter = useCallback(() => {
    if (isHoverEnabled() && !isHovered) {
      setIsHovered(true);
    }
  }, [isHovered]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered) {
      setIsHovered(false);
    }
  }, [isHovered]);

  const handleGrant = useCallback(() => {
    setShowHover(false);
    pressIn.current?.();
  }, []);

  const handleRelease = useCallback(() => {
    setShowHover(true);
    pressOut.current?.();
  }, []);

  let webProps = {};
  if (Platform.OS === "web") {
    webProps = {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      // prevent hover showing while responder
      onResponderGrant: handleGrant,
      onResponderRelease: handleRelease,
    };
  }

  return React.cloneElement(React.Children.only(children) as any, {
    ...webProps,
    // if child is Touchable
    onPressIn: handleGrant,
    onPressOut: handleRelease,
  });
}

/* end of Hoverable.tsx */
