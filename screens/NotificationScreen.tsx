/*
    Project: Hoot Mobile
    -------------------

    File: NotificationScreen.tsx

    Purpose:

        Displays a list of notifications (replies to posts or comments)
        for the logged-in user.

    Responsibilities:

        • Fetching user notifications from the Lotide API
        • Rendering notification items with context (original post/comment)
        • Navigating to the relevant post and highlighting the reply
        • Handling pull-to-refresh for new notifications

    This file intentionally does NOT contain:

        • Global notification state management (managed via local state and Redux hooks)
*/

import { useNavigation } from "@react-navigation/core";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";
import ActorDisplayComponent from "../components/ActorDisplay";
import ContentDisplay from "../components/ContentDisplay";
import RetryState from "../components/RetryState";
import SuggestLogin from "../components/SuggestLogin";

import { Text, View } from "../components/Themed";
import { useLotideCtx } from "../hooks/useLotideCtx";
import usePost from "../hooks/usePost";
import useComment from "../hooks/useComment";
import useTheme from "../hooks/useTheme";
import { useRefreshableData } from "../hooks/useRefreshableData";
import * as LotideService from "../services/LotideService";
import { RootStackScreenProps, RootTabScreenProps } from "../types";

/* ------------------------------------------------------------------------- */
/* Notification Screen Component                                             */
/* ------------------------------------------------------------------------- */

export default function NotificationScreen({
  navigation,
}: RootTabScreenProps<"NotificationScreen">) {
  const [notifications, setNotifications] = useState<FullNotification[]>([]);
  const [loadError, setLoadError] = useState("");
  const theme = useTheme();
  const ctx = useLotideCtx();
  const [isRefreshing, refresh] = useRefreshableData(
    stopLoading => {
      if (!ctx?.login) {
        setNotifications([]);
        setLoadError("");
        stopLoading();
        return;
      }

      setLoadError("");
      LotideService.getNotifications(ctx)
        .then(data => {
          setNotifications(data);
          setLoadError("");
        })
        .catch(() => {
          setNotifications([]);
          setLoadError("Cannot load notifications");
        })
        .finally(stopLoading);
    },
    [ctx?.login?.token],
  );
  useEffect(
    () => {
      const unsubscribe = navigation.addListener("focus", refresh);
      return unsubscribe;
    },
    [navigation, refresh],
  );

  if (!ctx?.login) return <SuggestLogin />;

  const renderItem = ({ item }: { item: FullNotification }) => (
    <Item item={item} />
  );

  /* ------------------------------------------------------------------------- */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------- */

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.background }]}
      data={notifications}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item.kind === "user_follow"
          ? `user_follow-${item.actor?.id ?? index}`
          : `${item.commentId}-${index}`
      }
      refreshing={isRefreshing}
      onRefresh={() => {
        refresh();
      }}
      ListEmptyComponent={
        !isRefreshing ? (
          <View style={styles.empty}>
            {loadError ? (
              <RetryState compact message={loadError} onRetry={refresh} />
            ) : (
              <Text style={{ color: theme.secondaryText }}>No notifications yet</Text>
            )}
          </View>
        ) : null
      }
    />
  );
}

/* ------------------------------------------------------------------------- */
/* Notification Item Component                                               */
/* ------------------------------------------------------------------------- */

const Item = ({ item }: { item: FullNotification }) => {
  if (item.kind === "user_follow") {
    return <UserFollowItem item={item} />;
  }

  return <ReplyItem item={item} />;
};

const UserFollowItem = ({ item }: { item: UserFollowNotification }) => {
  const theme = useTheme();
  const followActor = item.actor;

  return (
    <View
      style={[
        styles.item,
        {
          borderBottomColor: theme.secondaryBackground,
        },
      ]}
    >
      <Text style={{ color: theme.secondaryText, fontSize: 12, marginBottom: 5 }}>
        New follower
      </Text>
      {followActor ? (
        <ActorDisplayComponent
          name={followActor.username}
          host={followActor.host}
          local={followActor.local ?? false}
          showHost="only_foreign"
          colorize="never"
          userId={followActor.id}
        />
      ) : (
        <Text style={{ color: theme.secondaryText }}>Unknown actor</Text>
      )}
    </View>
  );
};

const ReplyItem = ({ item }: { item: ReplyNotification }) => {
  const post = usePost(item.postId);
  const itemOriginType = item.origin.type;
  const comment = useComment(
    itemOriginType === "comment" ? item.commentId : undefined,
  );
  const originComment = useComment(
    itemOriginType === "comment" ? item.origin.id : undefined,
  );
  const theme = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"Post">["navigation"]>();

  if (!post) return null;
  const author = post.author;
  const community = post.community;
  if (itemOriginType === "comment" && (!comment || !originComment)) {
    return null;
  }

  if (itemOriginType === "post" && !comment) {
    return (
      <Pressable
        accessibilityLabel={`Open notification for ${post.title}`}
        accessibilityRole="button"
        style={[
          styles.item,
          {
            borderBottomColor: theme.secondaryBackground,
          },
        ]}
        onPress={() => {
          navigation.navigate("Post", {
            postId: item.postId,
            highlightedComments:
              item.commentId !== item.postId ? [item.commentId] : undefined,
          });
        }}
      >
        <Text
          style={{ color: theme.secondaryText, fontSize: 12, marginBottom: 5 }}
        >
          New reply to your Post
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>{post.title}</Text>
        <View
          style={[
            styles.level1,
            {
              borderColor: theme.tint,
              backgroundColor: theme.secondaryBackground,
            },
          ]}
        >
          {author ? (
            <ActorDisplayComponent
              name={author.username}
              host={author.host}
              local={author.local ?? false}
              showHost="only_foreign"
              colorize="only_foreign"
            />
          ) : (
            <Text>Unknown author</Text>
          )}
          <Text style={{ color: theme.secondaryText, marginTop: 5 }}>
            View the post to read the latest reply.
          </Text>
        </View>
      </Pressable>
    );
  }

  if (!comment) return null;

  return (
    <Pressable
      accessibilityLabel={`Open notification for ${post.title}`}
      accessibilityRole="button"
      style={[
        styles.item,
        {
          borderBottomColor: theme.secondaryBackground,
        },
      ]}
      onPress={() => {
        const highlightedComments =
          itemOriginType === "comment" && item.origin
            ? [item.origin.id, item.commentId]
            : [item.commentId];
        navigation.navigate("Post", {
          postId: item.postId,
          highlightedComments,
        });
      }}
    >
      <Text
        style={{ color: theme.secondaryText, fontSize: 12, marginBottom: 5 }}
      >
        New reply to your {itemOriginType === "post" ? "Post" : "Comment"}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>{post.title}</Text>
      {author ? (
        <ActorDisplayComponent
              name={author.username}
              host={author.host}
              local={author.local ?? false}
              showHost="only_foreign"
              colorize="never"
              userId={author.id}
        />
      ) : (
        <Text>Unknown author</Text>
      )}
      {itemOriginType === "comment" && originComment ? (
        <>
          <View style={[styles.level1, { borderColor: theme.secondaryText }]}>
            <ActorOrUnknown actor={originComment.author} />
            <ContentDisplay
              contentHtml={originComment.content_html}
              contentText={originComment.content_text}
            />
          </View>
          <View
            style={[
              styles.level2,
              {
                borderColor: theme.tint,
                backgroundColor: theme.secondaryBackground,
              },
            ]}
          >
            <ActorOrUnknown actor={comment.author} />
            <ContentDisplay
              contentHtml={comment.content_html}
              contentText={comment.content_text}
            />
          </View>
        </>
      ) : (
        <>
          <View
            style={[
              styles.level1,
              {
                borderColor: theme.tint,
                backgroundColor: theme.secondaryBackground,
              },
            ]}
          >
            <ActorOrUnknown actor={comment.author} />
            <ContentDisplay
              contentHtml={comment.content_html}
              contentText={comment.content_text}
            />
          </View>
        </>
      )}
      {community?.name && community.host ? (
        <View style={styles.community}>
          <ActorDisplayComponent
            name={community.name}
            host={community.host}
            local={community.local}
            showHost={"always"}
            colorize={"never"}
            newLine
          />
        </View>
      ) : null}
    </Pressable>
  );
};

function ActorOrUnknown({ actor }: { actor?: Profile }) {
  const theme = useTheme();

  if (!actor) {
    return <Text style={{ color: theme.secondaryText }}>Unknown author</Text>;
  }

  return (
    <ActorDisplayComponent
      name={actor.username}
      host={actor.host}
      local={actor.local ?? false}
      showHost="only_foreign"
      colorize="only_foreign"
      userId={actor.id}
    />
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
    borderBottomWidth: 5,
    padding: 15,
  },
  title: {
    fontSize: 20,
    marginTop: 15,
    marginBottom: 5,
  },
  level1: {
    marginTop: 15,
    borderLeftWidth: 2,
    paddingLeft: 15,
    padding: 5,
  },
  level2: {
    marginTop: 5,
    marginLeft: 15,
    borderLeftWidth: 2,
    paddingLeft: 15,
    padding: 5,
  },
  community: {
    marginTop: 15,
  },
  empty: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

/* end of NotificationScreen.tsx */
