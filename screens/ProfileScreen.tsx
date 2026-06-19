/*
    Project: Hoot Mobile
    -------------------

    File: ProfileScreen.tsx

    Purpose:

        Show the logged-in user profile and account actions.

    Responsibilities:

        - Load profile and followed communities
        - Render profile description and account rows
        - Handle logout and navigation to activity/moderation/settings

    This file intentionally does NOT contain:

        - profile editing
        - moderation flag detail
*/

import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet } from "react-native";
import { View, Text } from "../components/Themed";
import { getUserData } from "../services/LotideService";
import { RootTabScreenProps } from "../types";
import SuggestLogin from "../components/SuggestLogin";
import * as LotideService from "../services/LotideService";
import * as StorageService from "../services/StorageService";
import useTheme from "../hooks/useTheme";
import ActorDisplayComponent from "../components/ActorDisplay";
import { useLotideCtx } from "../hooks/useLotideCtx";
import { useDispatch } from "react-redux";
import { setCtx } from "../slices/lotideSlice";
import { TappableList } from "../components/TappableList";
import ContentDisplay from "../components/ContentDisplay";
import RetryState from "../components/RetryState";
import { MINIMUM_TOUCH_TARGET_SIZE } from "../constants/TouchTargets";

export default function ProfileScreen({
  navigation,
}: RootTabScreenProps<"ProfileScreen">) {
  const [profile, setProfile] = useState<Profile>();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [focusId, setFocusId] = useState(0);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const theme = useTheme();
  const ctx = useLotideCtx();
  const dispatch = useDispatch();

  useEffect(
    () => navigation.addListener("focus", () => setFocusId(x => x + 1)),
    [navigation],
  );

  useEffect(() => {
    if (!ctx?.login) return;

    let isActive = true;

    LotideService.getAllCommunities(ctx, true)
      .then(communities => {
        if (!isActive) return;
        setProfileLoadError("");
        setCommunities(communities);
      })
      .catch(() => {
        if (!isActive) return;
        setCommunities([]);
        setProfileLoadError("");
      });

    return () => {
      isActive = false;
    };
  }, [ctx, focusId]);

  useEffect(() => {
    if (!ctx?.login) return;

    const userId = ctx.login.user?.id;
    if (!userId) {
      return;
    }

    getUserData(ctx, userId)
      .then(profileData => {
        setProfile(profileData);
        setProfileLoadError("");
      })
      .catch(() => {
        setProfileLoadError("Cannot load profile");
        setProfile(undefined);
      })
      .finally(() => setHasLoadedProfile(true));
  }, [ctx, focusId]);

  if (ctx?.login === undefined) {
    return <SuggestLogin />;
  }

  const retryProfileLoad = () => {
    setProfileLoadError("");
    setHasLoadedProfile(false);
    setFocusId(x => x + 1);
  };

  if (!ctx.login.user?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RetryState
          message="Cannot load profile"
          onRetry={retryProfileLoad}
        />
      </View>
    );
  }

  if (profileLoadError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RetryState message={profileLoadError} onRetry={retryProfileLoad} />
      </View>
    );
  }

  if (!profile && hasLoadedProfile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RetryState
          message="Cannot load profile"
          onRetry={retryProfileLoad}
        />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={styles.loadingText}>Loading profile</Text>
      </View>
    );
  }

  function logout() {
    if (!ctx?.login) return;
    const accountKey = ctx.login.user
      ? `${ctx.login.user.username}@${ctx.apiUrl}`
      : undefined;
    const removeStoredAccount = () =>
      accountKey
        ? StorageService.lotideContextKV.remove(accountKey)
        : Promise.resolve(undefined);

    if (Platform.OS === "web") {
      removeStoredAccount()
        .then(() => LotideService.logout(ctx))
        .then(() => dispatch(setCtx({})));
      return;
    }
    Alert.alert(
      "Log out",
      "Would you like to keep the login profile handy for later?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          onPress: () => {
            removeStoredAccount()
              .then(() => LotideService.logout(ctx))
              .then(() => dispatch(setCtx({})));
          },
        },
        {
          text: "Keep",
          style: "default",
          onPress: () => {
            StorageService.lotideContextKV.logout(ctx);
            dispatch(setCtx({}));
          },
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <View>
          <ActorDisplayComponent
            name={profile.username}
            host={profile.host}
            local={true}
            showHost="always"
            colorize="never"
            newLine
            style={{ fontSize: 18 }}
          />
          {!!profile.avatar && <Text>{profile.avatar.url}</Text>}
          {typeof profile.description === "string" ? (
            <Text>{profile.description}</Text>
          ) : (
            profile.description && (
              <ContentDisplay
                contentHtml={profile.description?.content_html}
                contentMarkdown={profile.description?.content_markdown}
                contentText={profile.description?.content_text}
              />
            )
          )}
        </View>
      </View>
      <TappableList
        items={[
          {
            title: "Your Activity",
            icon: "reader-outline",
            onPress: () =>
              navigation.navigate("ProfileActivity", {
                userId: profile.id || ctx.login?.user?.id,
                username: profile.username,
              }),
          },
          {
            title: "Moderation",
            icon: "shield-outline",
            onPress: () => navigation.navigate("Moderation"),
          },
          {
            title: "Switch Account",
            icon: "person-add-outline",
            onPress: () => dispatch(setCtx({})),
          },
          {
            title: "Log Out",
            icon: "log-out-outline",
            onPress: () => logout(),
          },
          {
            title: "App Settings",
            icon: "settings-outline",
            onPress: () => navigation.navigate("Settings"),
          },
          {
            title: "New Community",
            icon: "people-outline",
            onPress: () => navigation.navigate("NewCommunity"),
          },
        ]}
        style={{ marginHorizontal: 20 }}
      />

      <Text style={styles.followingTitle}>Communities You Follow:</Text>
      {communities.map(community => (
        <View
          key={community.id}
          style={[
            styles.altProfileButton,
            { borderColor: theme.secondaryBackground },
          ]}
        >
          <ActorDisplayComponent
            name={community.name}
            host={community.host}
            local={community.local}
            showHost={"always"}
            colorize={"always"}
            newLine={true}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: "100%",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  followingTitle: {
    fontSize: 18,
    fontWeight: "500",
    padding: 20,
  },
  editView: {
    margin: 20,
  },
  editViewText: {
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  editViewActionButtons: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  buttonView: {
    display: "flex",
    alignItems: "center",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
  inputContainer: {
    width: "100%",
    padding: 20,
  },
  input: {
    borderWidth: 1,
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: "100%",
    borderRadius: 8,
  },
  altProfileButton: {
    marginHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  loadingText: {
    padding: 20,
  },
});

/* end of ProfileScreen.tsx */
