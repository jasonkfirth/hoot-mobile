/*
    Project: Hoot Mobile
    -------------------

    File: HapticService.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export { ImpactFeedbackStyle } from "expo-haptics";

export async function impactAsync(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === "web") return;
  await Haptics.impactAsync(style);
}

/* end of HapticService.ts */
