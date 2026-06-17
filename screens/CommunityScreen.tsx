/*
    Project: Hoot Mobile
    -------------------

    File: CommunityScreen.tsx

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import React, { useEffect, useState } from "react";
import { Alert, Button, FlatList, Pressable, StyleSheet } from "react-native";
import { View, Text } from "../components/Themed";
import useTheme from "../hooks/useTheme";
import { RootStackScreenProps } from "../types";
import * as Haptics from "../services/HapticService";
import * as LotideService from "../services/LotideService";
import PostDisplay from "../components/PostDisplay";
import { ActorDisplay } from "../components/ActorDisplay";
import { useNavigation } from "@react-navigation/native";
import { useLotideCtx } from "../hooks/useLotideCtx";
import useFeed from "../hooks/useFeed";
import ContentDisplay from "../components/ContentDisplay";
import RetryState from "../components/RetryState";

export default function CommunityScreen({
  route,
}: RootStackScreenProps<"Community">) {
  const [communityLoadError, setCommunityLoadError] = useState("");
  const routeCommunity = route.params?.community;
  const communityId = getRouteCommunityId(route.params);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, loadNextPage, refreshPosts, feedLoadError] = useFeed({
    sort: "hot",
    communityId,
    enabled: !!communityId,
  });
  const [reloadId, setReloadId] = useState(0);
  const theme = useTheme();
  const ctx = useLotideCtx();
  const currentCommunity = getRenderableCommunity(routeCommunity) || community;

  const retryCommunityLoad = () => {
    setCommunityLoadError("");
    setReloadId(x => x + 1);
  };

  useEffect(() => {
    if (!ctx || !communityId) return;

    LotideService.getCommunity(ctx, communityId)
      .then(data => {
        setCommunity(data);
        setCommunityLoadError("");
      })
      .catch(() => {
        setCommunity(null);
        setCommunityLoadError("Cannot load community");
      });
  }, [ctx, communityId, reloadId]);

  if (!currentCommunity) {
    return (
      <View
        style={[styles.root, { backgroundColor: theme.background }]}
      >
        {communityLoadError && communityId ? (
          <RetryState
            message={communityLoadError}
            onRetry={retryCommunityLoad}
            style={styles.emptyState}
          />
        ) : (
          <Text>
            {communityId ? "Loading community" : "Cannot load community"}
          </Text>
        )}
      </View>
    );
  }

  const renderItem = ({ item }: { item: PostId }) => <Item postId={item} />;

  const feedList = (
    <FlatList
      data={posts}
      renderItem={renderItem}
      ListHeaderComponent={
        <ListHeader
          community={currentCommunity}
          communityLoadError={communityLoadError}
          onRetryCommunity={retryCommunityLoad}
          setReloadId={setReloadId}
        />
      }
      ListEmptyComponent={
        feedLoadError ? (
          <RetryState
            compact
            message={feedLoadError}
            onRetry={refreshPosts}
            style={[styles.emptyState, { borderColor: theme.secondaryBackground }]}
          />
        ) : null
      }
      keyExtractor={(postId, index) => `${postId}-${index}`}
      refreshing={posts.length === 0 && !feedLoadError}
      onRefresh={refreshPosts}
      onEndReachedThreshold={2}
      onEndReached={loadNextPage}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {feedList}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: "100%",
  },
  header: {
    padding: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth || 1,
  },
  title: {
    fontSize: 20,
  },
  description: {
    marginTop: 10,
  },
  buttons: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  item: {
    marginVertical: 0,
    marginHorizontal: 0,
    borderBottomWidth: 8,
  },
  emptyState: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth || 1,
  },
  headerRetry: {
    marginTop: 15,
  },
});

function getRouteCommunityId(
  params: RootStackScreenProps<"Community">["route"]["params"],
): CommunityId | undefined {
  const rawId = params?.community?.id ?? params?.id;

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return rawId;
  }

  if (typeof rawId === "string" && rawId.trim() !== "") {
    const numericId = Number(rawId);
    if (Number.isFinite(numericId)) {
      return numericId;
    }
  }

  return undefined;
}

function getRenderableCommunity(
  community?: Partial<Community>,
): Community | null {
  if (!community?.id || !community.name || !community.host) {
    return null;
  }

  return community as Community;
}

const Item = ({ postId }: { postId: PostId }) => {
  const theme = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"Community">["navigation"]>();
  return (
    <Pressable
      onPress={() => navigation.navigate("Post", { postId })}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }}
    >
      <View
        style={[styles.item, { borderBottomColor: theme.secondaryBackground }]}
      >
        <PostDisplay postId={postId} navigation={navigation} truncateContent />
      </View>
    </Pressable>
  );
};

type ListHeaderProps = {
  community: Community;
  communityLoadError: string;
  onRetryCommunity: () => void;
  setReloadId: (a: (x: number) => number) => void;
};

const ListHeader = React.memo(function ListHeader(props: ListHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"Community">["navigation"]>();
  const community = props.community;
  const communityLoadError = props.communityLoadError;
  const onRetryCommunity = props.onRetryCommunity;
  const setReloadId = props.setReloadId;
  const ctx = useLotideCtx();

  const isFollowing = community.your_follow?.accepted || false;

  function follow() {
    if (!ctx) return;
    LotideService.followCommunity(ctx, community.id)
      .then(data => {
        if (data.accepted === false) {
          Alert.alert(
            "Follow request not accepted yet.",
            "This can happen while the other node is still processing it.",
          );
        }
        setReloadId(x => x + 1);
      })
      .catch(() => {
        Alert.alert("Failed to follow community");
      });
  }

  function unfollow() {
    if (!ctx) return;
    LotideService.unfollowCommunity(ctx, community.id)
      .then(() => {
        setReloadId(x => x + 1);
      })
      .catch(() => {
        Alert.alert("Failed to unfollow community");
      });
  }

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: theme.tertiaryBackground,
        },
      ]}
    >
      <View>
        <ActorDisplay
          name={community.name}
          host={community.host}
          local={community.local}
          newLine={true}
          colorize="always"
          showHost="always"
          styleName={[styles.title]}
        />
        {community.description !== "" &&
          (typeof community.description === "string" ? (
            <Text style={styles.description}>{community.description}</Text>
          ) : (
            <ContentDisplay
              contentHtml={community.description?.content_html}
              contentMarkdown={community.description?.content_markdown}
              contentText={community.description?.content_text}
            />
          ))}
        {communityLoadError ? (
          <RetryState
            compact
            message={communityLoadError}
            onRetry={onRetryCommunity}
            style={styles.headerRetry}
          />
        ) : null}
      </View>
      {!!ctx && (
        <View style={[styles.buttons]}>
          <Button
            onPress={() => navigation.navigate("NewPostScreen", { community })}
            title="Post"
            color={theme.tint}
            accessibilityLabel="Post to this community"
          />
          {community.you_are_moderator && (
            <Button
              onPress={() =>
                navigation.navigate("EditCommunity", { community })
              }
              title="Edit"
              color={theme.tint}
              accessibilityLabel="Edit your community community"
            />
          )}
          {isFollowing ? (
            <Button
              onPress={unfollow}
              title="Unfollow"
              color={theme.secondaryTint}
              accessibilityLabel="Stop seeing posts from this community"
            />
          ) : (
            <Button
              onPress={follow}
              title="Follow"
              color={theme.tint}
              accessibilityLabel="See posts from this community in your feed"
            />
          )}
        </View>
      )}
    </View>
  );
});

/* end of CommunityScreen.tsx */
