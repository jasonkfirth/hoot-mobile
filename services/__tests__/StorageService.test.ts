/*
    Project: Hoot Mobile
    -------------------

    File: StorageService.test.ts

    Purpose:

        Validate defensive parsing for persisted Lotide account state.

    Responsibilities:

        - Verify corrupt active context storage recovers safely
        - Verify saved account storage ignores malformed entries
        - Verify account storage remains usable after recovery

    This file intentionally does NOT contain:

        - React component tests
        - AsyncStorage native integration tests
        - network request tests
*/

import AsyncStorage from "@react-native-async-storage/async-storage";

import { lotideContext, lotideContextKV } from "../StorageService";

describe("StorageService", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test("recovers from corrupt active context JSON", async () => {
    await AsyncStorage.setItem("@lotide_ctx", "{not json");

    await expect(lotideContext.query()).resolves.toBeUndefined();
    await expect(AsyncStorage.getItem("@lotide_ctx")).resolves.toBeNull();
  });

  test("filters malformed saved account entries", async () => {
    await AsyncStorage.setItem(
      "@lotide_ctx_arr",
      JSON.stringify({
        "alice@https://lotide.fbxl.net/api/unstable": {
          apiUrl: "https://lotide.fbxl.net/api/unstable",
        },
        "broken@https://lotide.fbxl.net/api/unstable": "not a context",
      }),
    );

    await expect(lotideContextKV.getStore()).resolves.toEqual({
      "alice@https://lotide.fbxl.net/api/unstable": {
        apiUrl: "https://lotide.fbxl.net/api/unstable",
      },
    });
  });

  test("continues to store accounts after a corrupt store is cleared", async () => {
    await AsyncStorage.setItem("@lotide_ctx_arr", "{not json");

    await lotideContextKV.store({
      apiUrl: "https://lotide.fbxl.net/api/unstable",
      login: {
        token: "token-1",
        user: {
          id: 1,
          username: "alice",
          host: "lotide.fbxl.net",
        },
      },
    });

    await expect(lotideContextKV.listKeys()).resolves.toEqual([
      "alice@https://lotide.fbxl.net/api/unstable",
    ]);
  });
});

/* end of StorageService.test.ts */
