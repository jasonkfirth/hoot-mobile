/*
    Project: Hoot Mobile
    -------------------

    File: useTheme.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import Colors from "../constants/Colors";
import useColorScheme from "./useColorScheme";

export default function useTheme() {
  const colorScheme = useColorScheme();
  return Colors[colorScheme];
}

/* end of useTheme.ts */
