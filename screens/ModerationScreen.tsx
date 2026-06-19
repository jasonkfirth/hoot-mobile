/*
    Project: Hoot Mobile
    -------------------

    File: ModerationScreen.tsx

    Purpose:

        Displays the logged-in user's moderation dashboard using the
        same Lotide endpoints used by hitide.

    Responsibilities:

        • Fetch communities moderated by the current account
        • Fetch pending flags for the selected moderated community
        • Navigate flagged posts to their post screen
        • Handle empty and failed API states without crashing

    This file intentionally does NOT contain:

        • Flag dismissal or approval actions
        • Community editing
        • Site administration workflows
*/

import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet } from "react-native";
import AppButton from "../components/AppButton";
import ActorDisplayComponent from "../components/ActorDisplay";
import RetryState from "../components/RetryState";
import SuggestLogin from "../components/SuggestLogin";
import { Text, View } from "../components/Themed";
import useTheme from "../hooks/useTheme";
import { useLotideCtx } from "../hooks/useLotideCtx";
import * as LotideService from "../services/LotideService";
import type { CommunityFlag } from "../services/LotideService";
import { RootStackScreenProps } from "../types";
import { MINIMUM_TOUCH_TARGET_SIZE } from "../constants/TouchTargets";

/* ------------------------------------------------------------------------- */
/* Moderation Screen                                                         */
/* ------------------------------------------------------------------------- */

export default function ModerationScreen({
  navigation,
}: RootStackScreenProps<"Moderation">) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] =
    useState<CommunityId>();
  const [flags, setFlags] = useState<CommunityFlag[]>([]);
  const [communityLoadError, setCommunityLoadError] = useState("");
  const [flagLoadError, setFlagLoadError] = useState("");
  const [hasLoadedCommunities, setHasLoadedCommunities] = useState(false);
  const [hasLoadedFlags, setHasLoadedFlags] = useState(false);
  const [communityReloadId, setCommunityReloadId] = useState(0);
  const [flagReloadId, setFlagReloadId] = useState(0);

  useEffect(() => {
    if (!ctx?.login) return;

    LotideService.getModeratedCommunities(ctx)
      .then(data => {
        const loadedCommunities = data.items || [];
        setCommunities(loadedCommunities);
        setSelectedCommunityId(existingId =>
          existingId || loadedCommunities[0]?.id,
        );
        setCommunityLoadError("");
      })
      .catch(() => {
        setCommunities([]);
        setSelectedCommunityId(undefined);
        setCommunityLoadError("Cannot load moderated communities");
      })
      .finally(() => setHasLoadedCommunities(true));
  }, [ctx, communityReloadId]);

  useEffect(() => {
    if (!ctx?.login || !selectedCommunityId) {
      return;
    }

    LotideService.getCommunityFlags(ctx, selectedCommunityId)
      .then(data => {
        setFlags(data.items || []);
        setFlagLoadError("");
      })
      .catch(() => {
        setFlags([]);
        setFlagLoadError("Cannot load moderation flags");
      })
      .finally(() => setHasLoadedFlags(true));
  }, [ctx, selectedCommunityId, flagReloadId]);

  if (!ctx?.login) return <SuggestLogin />;

  const selectedCommunity = communities.find(
    community => community.id === selectedCommunityId,
  );

  const retryCommunities = () => {
    setHasLoadedCommunities(false);
    setCommunityLoadError("");
    setCommunityReloadId(x => x + 1);
  };

  const retryFlags = () => {
    setHasLoadedFlags(false);
    setFlagLoadError("");
    setFlagReloadId(x => x + 1);
  };

  const dismissFlag = (flagId: number) => {
    if (!ctx?.login) return;

    LotideService.dismissCommunityFlag(ctx, flagId)
      .then(() => {
        setFlags(existingFlags =>
          existingFlags.filter(flag => flag.id !== flagId),
        );
      })
      .catch(() => {
        Alert.alert("Failed to dismiss flag");
      });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {communityLoadError ? (
        <RetryState
          compact
          message={communityLoadError}
          onRetry={retryCommunities}
          style={styles.empty}
        />
      ) : null}
      {!communityLoadError && hasLoadedCommunities && communities.length === 0 ? (
        <Text style={[styles.empty, { color: theme.secondaryText }]}>
          No moderated communities
        </Text>
      ) : null}
      {communities.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {communities.map(community => (
            <Pressable
              accessibilityLabel={`Select moderated community ${community.name}`}
              accessibilityRole="button"
              key={community.id}
              onPress={() => setSelectedCommunityId(community.id)}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    community.id === selectedCommunityId
                      ? theme.tint
                      : theme.secondaryBackground,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    community.id === selectedCommunityId
                      ? theme.background
                      : theme.text,
                }}
              >
                {community.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {selectedCommunity ? (
        <View style={styles.selectedCommunity}>
          <ActorDisplayComponent
            name={selectedCommunity.name}
            host={selectedCommunity.host}
            local={selectedCommunity.local}
            showHost="always"
            colorize="always"
            newLine
          />
        </View>
      ) : null}

      {flagLoadError ? (
        <RetryState
          compact
          message={flagLoadError}
          onRetry={retryFlags}
          style={styles.empty}
        />
      ) : null}
      {!flagLoadError && hasLoadedFlags && selectedCommunity && flags.length === 0 ? (
        <Text style={[styles.empty, { color: theme.secondaryText }]}>
          No pending flags
        </Text>
      ) : null}
      {flags.map(flag => (
        <FlagItem
          key={flag.id}
          flag={flag}
          navigation={navigation}
          onDismiss={dismissFlag}
        />
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------------- */
/* Flag Item                                                                 */
/* ------------------------------------------------------------------------- */

function FlagItem({
  flag,
  navigation,
  onDismiss,
}: {
  flag: CommunityFlag;
  navigation: RootStackScreenProps<"Moderation">["navigation"];
  onDismiss: (flagId: number) => void;
}) {
  const theme = useTheme();
  const canOpenPost = !!flag.post?.id;

  return (
    <View style={[styles.flag, { borderBottomColor: theme.secondaryBackground }]}>
      <Pressable
        accessibilityLabel={
          flag.post?.title
            ? `Open flagged post ${flag.post.title}`
            : "Flagged item"
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: !canOpenPost }}
        disabled={!canOpenPost}
        onPress={() =>
          flag.post?.id && navigation.navigate("Post", { postId: flag.post.id })
        }
      >
        <Text style={[styles.flagTitle, { color: theme.text }]}>
          {flag.post?.title || "Flagged item"}
        </Text>
        {flag.flagger ? (
          <ActorDisplayComponent
            name={flag.flagger.username}
            host={flag.flagger.host}
            local={flag.flagger.local ?? false}
            showHost="only_foreign"
            colorize="only_foreign"
            userId={flag.flagger.id}
          />
        ) : null}
        {flag.content?.content_text ? (
          <Text style={[styles.reason, { color: theme.secondaryText }]}>
            {flag.content.content_text}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.flagActions}>
        <AppButton
          title="Dismiss"
          color={theme.tint}
          onPress={() => onDismiss(flag.id)}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------- */
/* Styles                                                                    */
/* ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  tab: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    marginRight: 8,
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedCommunity: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  flag: {
    borderBottomWidth: 8,
    padding: 15,
  },
  flagTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  reason: {
    marginTop: 8,
  },
  flagActions: {
    alignItems: "flex-start",
    marginTop: 10,
  },
  empty: {
    padding: 20,
  },
});

/* end of ModerationScreen.tsx */
