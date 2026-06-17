/*
    Project: Hoot Mobile
    -------------------

    File: App.tsx

    Purpose:

        The entry point for the Hoot Mobile application. Manages initialization,
        context persistence, and the root navigation structure.

    Responsibilities:

        • Bootstrapping the application (Provider, StatusBar)
        • Loading cached resources and persistence data
        • Handling Lotide context synchronization with the server
        • Managing application state via Redux

    This file intentionally does NOT contain:

        • Specific screen implementations
        • Direct API request logic (see services/LotideService)
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import useCachedResources from "./hooks/useCachedResources";
import useColorScheme from "./hooks/useColorScheme";
import Navigation from "./navigation";
import * as StorageService from "./services/StorageService";
import * as LotideService from "./services/LotideService";
import * as LotideNotificationPoller from "./services/LotideNotificationPoller";
import { Provider, useDispatch } from "react-redux";
import { setCtx } from "./slices/lotideSlice";
import reduxStore from "./store/reduxStore";
import { useLotideCtx } from "./hooks/useLotideCtx";
import { Alert, Platform } from "react-native";
import { getErrorMessage } from "./utils/error";

/* ------------------------------------------------------------------------- */
/* Main Application Component                                                */
/* ------------------------------------------------------------------------- */

function App() {
  const isLoadingComplete = useCachedResources();
  const colorScheme = useColorScheme();
  const ctx = useLotideCtx();
  const dispatch = useDispatch();

  const applyNewContext = useCallback(
    async (nextCtx: LotideContext) => {
      await StorageService.lotideContextKV.store(nextCtx);
      await AsyncStorage.setItem("@lotide_ctx", JSON.stringify(nextCtx));
      dispatch(setCtx(nextCtx));
    },
    [dispatch],
  );

  /* ------------------------------------------------------------------------- */
  /* Initialization and Persistence                                            */
  /* ------------------------------------------------------------------------- */

  useEffect(() => {
    if (Platform.OS === "android") {
      LotideNotificationPoller.registerNotificationPollTask().catch(() => {
        console.error("Failed to register background notification task");
      });
    }

  }, []);

  /* ------------------------------------------------------------------------- */
  /* API Synchronization                                                       */
  /* ------------------------------------------------------------------------- */

  useEffect(() => {
    StorageService.lotideContext.query().then(ctx => {
      if (ctx !== undefined) {
        dispatch(setCtx(ctx));
      }
    });
  }, [dispatch]);

  /* ------------------------------------------------------------------------- */
  /* API Synchronization                                                       */
  /* ------------------------------------------------------------------------- */

  useEffect(() => {
    if (!ctx?.apiUrl) return;
    LotideService.getInstanceInfo(ctx)
      .then(data => {
        console.log(ctx);
        console.log("version", data.apiVersion);
        if (data.apiVersion < 8) throw "Bad version";
        if (data.apiVersion === ctx.apiVersion) return;
        applyNewContext({
          ...ctx,
          apiVersion: data.apiVersion,
        });
      })
      .catch(e => {
        Alert.alert("Failed to login", getErrorMessage(e));
        StorageService.lotideContextKV
          .remove(`${ctx.login?.user?.username}@${ctx.apiUrl}`)
          .then(() => applyNewContext({}));
      });
    if (!ctx.login?.user) return;
    LotideService.getUserData(ctx, ctx.login.user.id).catch(() => {
      StorageService.lotideContextKV
        .remove(`${ctx.login?.user?.username}@${ctx.apiUrl}`)
        .then(() => applyNewContext({}));
    });
  }, [applyNewContext, ctx]);

  /* ------------------------------------------------------------------------- */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------- */

  if (!isLoadingComplete) {
    return null;
  } else {
    return (
      <SafeAreaProvider>
        <Navigation colorScheme={colorScheme} />
        <StatusBar />
      </SafeAreaProvider>
    );
  }
}

/**
    Root component provides the Redux store to the application.
*/
export default function AppRoot() {
  return (
    <Provider store={reduxStore}>
      <App />
    </Provider>
  );
}

/* end of App.tsx */
