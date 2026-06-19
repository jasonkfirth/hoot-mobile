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
import { Alert, AppState, Platform } from "react-native";
import { getErrorMessage } from "./utils/error";
import { MINIMUM_LOTIDE_API_VERSION } from "./constants/LotideApi";

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
      LotideNotificationPoller.registerNotificationPollTask().catch(error => {
        console.warn(
          "Failed to register background notification task",
          getErrorMessage(error),
        );
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!ctx?.login) return;

    const pollCurrentContext = () => {
      LotideNotificationPoller.pollNotificationsNow(ctx).catch(error => {
        console.warn(
          "Failed to poll Lotide notifications",
          getErrorMessage(error),
        );
      });
    };

    pollCurrentContext();

    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") {
        pollCurrentContext();
      }
    });

    return () => subscription.remove();
  }, [ctx]);

  /* ------------------------------------------------------------------------- */
  /* Stored Context Loading                                                    */
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

    let isActive = true;

    const applyContextSafely = (nextCtx: LotideContext) => {
      applyNewContext(nextCtx).catch(error => {
        console.warn("Failed to persist Lotide context", getErrorMessage(error));
      });
    };

    const expireLogin = () => {
      StorageService.lotideContextKV
        .logout(ctx)
        .then(() => {
          if (!isActive) return;

          applyContextSafely({
            apiUrl: ctx.apiUrl,
            apiVersion: ctx.apiVersion,
          });
        })
        .catch(error => {
          console.warn("Failed to expire stored Lotide login", getErrorMessage(error));
        });
    };

    LotideService.getInstanceInfo(ctx)
      .then(data => {
        if (!isActive) return;

        if (data.apiVersion < MINIMUM_LOTIDE_API_VERSION) {
          Alert.alert(
            "Server not supported",
            "The selected Lotide server is too old for this version of Hoot.",
          );
          applyContextSafely({});
          return;
        }

        if (data.apiVersion === ctx.apiVersion) return;
        applyContextSafely({
          ...ctx,
          apiVersion: data.apiVersion,
        });
      })
      .catch(e => {
        if (!isActive) return;

        Alert.alert("Cannot refresh server info", getErrorMessage(e));
      });

    if (ctx.login?.user) {
      LotideService.getUserData(ctx, ctx.login.user.id).catch(e => {
        if (!isActive) return;

        if (LotideService.isAuthenticationError(e)) {
          Alert.alert(
            "Session expired",
            "Please sign in again to continue using this Lotide account.",
          );
          expireLogin();
          return;
        }

        console.warn("Failed to refresh Lotide profile", getErrorMessage(e));
      });
    }

    return () => {
      isActive = false;
    };
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
