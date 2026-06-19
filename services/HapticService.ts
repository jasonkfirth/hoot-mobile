/*
    Project: Hoot Mobile
    -------------------

    File: HapticService.ts

    Purpose:

        Wrap platform haptic feedback calls.

    Responsibilities:

        - Skip haptics on web
        - Expose the subset of Expo haptics used by the UI

    This file intentionally does NOT contain:

        - gesture handling
        - business logic
*/

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export { ImpactFeedbackStyle } from "expo-haptics";

export async function impactAsync(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;
  await Haptics.impactAsync(style);
}

/* end of HapticService.ts */
