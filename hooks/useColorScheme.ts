/*
    Project: Hoot Mobile
    -------------------

    File: useColorScheme.ts

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import { useColorScheme as _useColorScheme } from 'react-native';

export type AppColorScheme = "light" | "dark";

export default function useColorScheme(): AppColorScheme {
  return _useColorScheme() === "dark" ? "dark" : "light";
}

/* end of useColorScheme.ts */
