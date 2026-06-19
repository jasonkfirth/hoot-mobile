/*
    Project: Hoot Mobile
    -------------------

    File: ProfileActivityScreen.tsx

    Purpose:

        Displays the mixed post and comment activity exposed by the
        Lotide user "things" API.

    Responsibilities:

        • Fetch profile activity for the selected user
        • Render post and comment activity entries
        • Navigate activity entries to the related post screen
        • Handle empty, loading, and failed API states without crashing

    This file intentionally does NOT contain:

        • Profile editing
        • Account switching or logout behavior
        • Moderation workflows
*/

import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet } from "react-native";
import ActorDisplayComponent from "../components/ActorDisplay";
import ContentDisplay from "../components/ContentDisplay";
import ElapsedTime from "../components/ElapsedTime";
import SuggestLogin from "../components/SuggestLogin";
import RetryState from "../components/RetryState";
import { Text, View } from "../components/Themed";
import {
  supportsPrivateMessages,
  supportsUserFollows,
} from "../constants/LotideApi";
import { MINIMUM_TOUCH_TARGET_SIZE } from "../constants/TouchTargets";
import useTheme from "../hooks/useTheme";
import { useLotideCtx } from "../hooks/useLotideCtx";
import * as LotideService from "../services/LotideService";
import type { UserThing } from "../services/LotideService";
import { RootStackScreenProps } from "../types";

/* ------------------------------------------------------------------------- */
/* Profile Activity Screen                                                   */
/* ------------------------------------------------------------------------- */

export default function ProfileActivityScreen({
  navigation,
  route,
}: RootStackScreenProps<"ProfileActivity">) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const userId = route.params?.userId ?? ctx?.login?.user?.id;
  const [items, setItems] = useState<UserThing[]>([]);
  const [nextPage, setNextPage] = useState<string | null | undefined>();
  const [profile, setProfile] = useState<Profile | undefined>();
  const [profileError, setProfileError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadId, setReloadId] = useState(0);
  const isOwnProfile = userId === ctx?.login?.user?.id;

  useEffect(() => {
    if (!ctx?.apiUrl || !userId) return;

    LotideService.getUserThings(ctx, userId)
      .then(data => {
        setItems(data.items || []);
        setNextPage(data.next_page);
        setLoadError("");
      })
      .catch(() => {
        setItems([]);
        setNextPage(null);
        setLoadError("Cannot load activity");
      })
      .finally(() => setIsLoading(false));
  }, [ctx, userId, reloadId]);

  useEffect(() => {
    if (!ctx?.login || !userId) return;

    let isActive = true;

    LotideService.getUserData(ctx, userId)
      .then(data => {
        if (!isActive) return;
        setProfile(data);
        setProfileError("");
      })
      .catch(() => {
        if (!isActive) return;
        setProfile(undefined);
        setProfileError("Cannot load profile");
      });

    return () => {
      isActive = false;
    };
  }, [ctx, userId, reloadId]);

  if (!ctx?.login) return <SuggestLogin />;

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError("");
    setReloadId(x => x + 1);
  };

  const loadNextPage = () => {
    if (!ctx?.apiUrl || !userId || !nextPage) return;

    LotideService.getUserThings(ctx, userId, nextPage)
      .then(data => {
        setItems(existingItems => [...existingItems, ...(data.items || [])]);
        setNextPage(data.next_page);
      })
      .catch(() => {
        setNextPage(null);
      });
  };

  const renderItem = ({ item }: { item: UserThing }) => (
    <ActivityItem item={item} navigation={navigation} />
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.background }]}
      data={items}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
      onEndReached={loadNextPage}
      onEndReachedThreshold={2}
      ListHeaderComponent={
        <ProfileActivityHeader
          isOwnProfile={isOwnProfile}
          onChanged={retryLoad}
          profile={profile}
          profileError={profileError}
          routeUsername={route.params?.username}
          userId={userId}
          navigation={navigation}
        />
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            {loadError ? (
              <RetryState compact message={loadError} onRetry={retryLoad} />
            ) : (
              <Text style={{ color: theme.secondaryText }}>No activity yet</Text>
            )}
          </View>
        ) : null
      }
    />
  );
}

/* ------------------------------------------------------------------------- */
/* Profile Header                                                            */
/* ------------------------------------------------------------------------- */

function ProfileActivityHeader({
  isOwnProfile,
  navigation,
  onChanged,
  profile,
  profileError,
  routeUsername,
  userId,
}: {
  isOwnProfile: boolean;
  navigation: RootStackScreenProps<"ProfileActivity">["navigation"];
  onChanged: () => void;
  profile?: Profile;
  profileError: string;
  routeUsername?: string;
  userId?: UserId;
}) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const canFollowUsers = supportsUserFollows(ctx?.apiVersion);
  const canMessage = supportsPrivateMessages(ctx?.apiVersion);
  const isFollowing = !!profile?.your_follow;
  const displayName = profile?.username || routeUsername;

  if (!userId || (!profile && !profileError && !routeUsername)) {
    return null;
  }

  function followOrUnfollow() {
    if (!ctx?.login || !userId || isOwnProfile || !canFollowUsers) return;

    if (isFollowing) {
      LotideService.unfollowUser(ctx, userId)
        .then(onChanged)
        .catch(() => Alert.alert("Failed to unfollow user"));
      return;
    }

    LotideService.followUser(ctx, userId)
      .then(result => {
        if (!result.accepted) {
          Alert.alert(
            "Follow request sent",
            "The remote user has not accepted the follow yet.",
          );
        }
        onChanged();
      })
      .catch(() => Alert.alert("Failed to follow user"));
  }

  return (
    <View
      style={[
        styles.profileHeader,
        { borderBottomColor: theme.secondaryBackground },
      ]}
    >
      {profile ? (
        <>
          <ActorDisplayComponent
            name={profile.username}
            host={profile.host}
            local={profile.local ?? false}
            showHost="always"
            colorize="only_foreign"
            userId={profile.id}
            styleName={styles.profileName}
          />
          {typeof profile.description === "string" ? (
            <Text style={{ color: theme.secondaryText }}>
              {profile.description}
            </Text>
          ) : profile.description ? (
            <View style={styles.profileDescription}>
              <ContentDisplay
                contentHtml={profile.description.content_html}
                contentMarkdown={profile.description.content_markdown}
                contentText={profile.description.content_text}
                maxChars={400}
              />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.profileName, { color: theme.text }]}>
          {displayName || `User ${userId}`}
        </Text>
      )}
      {profileError ? (
        <Text style={{ color: theme.secondaryText }}>{profileError}</Text>
      ) : null}
      {!isOwnProfile && (
        <View style={styles.profileActions}>
          {canFollowUsers ? (
            <Pressable
              accessibilityLabel={
                isFollowing
                  ? `Unfollow ${displayName || "user"}`
                  : `Follow ${displayName || "user"}`
              }
              accessibilityRole="button"
              onPress={followOrUnfollow}
              style={[
                styles.profileActionButton,
                {
                  backgroundColor: isFollowing
                    ? theme.secondaryBackground
                    : theme.tint,
                },
              ]}
            >
              <Text
                style={{
                  color: isFollowing ? theme.text : "#111827",
                  fontWeight: "600",
                }}
              >
                {isFollowing
                  ? profile?.your_follow?.accepted
                    ? "Unfollow"
                    : "Cancel Follow"
                  : "Follow"}
              </Text>
            </Pressable>
          ) : null}
          {canMessage ? (
            <Pressable
              accessibilityLabel={`Message ${displayName || "user"}`}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate("MessageThread", {
                  userId,
                  username: displayName,
                })}
              style={[
                styles.profileActionButton,
                { backgroundColor: theme.secondaryBackground },
              ]}
            >
              <Text style={{ color: theme.text, fontWeight: "600" }}>
                Message
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------------- */
/* Activity Items                                                            */
/* ------------------------------------------------------------------------- */

function ActivityItem({
  item,
  navigation,
}: {
  item: UserThing;
  navigation: RootStackScreenProps<"ProfileActivity">["navigation"];
}) {
  if (item.type === "post") {
    return <PostActivityItem item={item} navigation={navigation} />;
  }

  return <CommentActivityItem item={item} navigation={navigation} />;
}

function PostActivityItem({
  item,
  navigation,
}: {
  item: Extract<UserThing, { type: "post" }>;
  navigation: RootStackScreenProps<"ProfileActivity">["navigation"];
}) {
  const theme = useTheme();
  const community = item.community;
  const author = item.author;

  return (
    <Pressable
      accessibilityLabel={`Open post ${item.title}`}
      accessibilityRole="button"
      onPress={() => navigation.navigate("Post", { postId: item.id })}
      style={[styles.item, { borderBottomColor: theme.secondaryBackground }]}
    >
      <Text style={styles.typeLabel}>Post</Text>
      <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
      {author ? (
        <ActorDisplayComponent
          name={author.username}
          host={author.host}
          local={author.local ?? false}
          showHost="only_foreign"
          colorize="never"
          userId={author.id}
        />
      ) : null}
      {community?.name && community.host ? (
        <View style={styles.meta}>
          <ActorDisplayComponent
            name={community.name}
            host={community.host}
            local={community.local}
            showHost="only_foreign"
            colorize="only_foreign"
          />
        </View>
      ) : null}
      {item.created ? (
        <View style={styles.meta}>
          <ElapsedTime time={item.created} />
        </View>
      ) : null}
    </Pressable>
  );
}

function CommentActivityItem({
  item,
  navigation,
}: {
  item: Extract<UserThing, { type: "comment" }>;
  navigation: RootStackScreenProps<"ProfileActivity">["navigation"];
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={`Open comment on ${item.post.title}`}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate("Post", {
          postId: item.post.id,
          highlightedComments: [item.id],
        })
      }
      style={[styles.item, { borderBottomColor: theme.secondaryBackground }]}
    >
      <Text style={styles.typeLabel}>Comment</Text>
      <Text style={[styles.title, { color: theme.text }]}>{item.post.title}</Text>
      {item.created ? (
        <View style={styles.meta}>
          <ElapsedTime time={item.created} />
        </View>
      ) : null}
      <View style={styles.content}>
        <ContentDisplay
          contentHtml={item.content_html || undefined}
          contentText={item.content_text || undefined}
          maxChars={300}
        />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------------- */
/* Styles                                                                    */
/* ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    borderBottomWidth: 8,
    padding: 15,
  },
  profileHeader: {
    borderBottomWidth: 8,
    padding: 15,
  },
  profileName: {
    fontSize: 20,
    marginBottom: 8,
  },
  profileDescription: {
    marginTop: 8,
  },
  profileActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  profileActionButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    minWidth: 92,
    paddingHorizontal: 12,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
  },
  meta: {
    marginTop: 8,
  },
  content: {
    marginTop: 10,
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
});

/* end of ProfileActivityScreen.tsx */
