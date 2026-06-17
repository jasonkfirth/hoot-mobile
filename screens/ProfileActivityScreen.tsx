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
import { FlatList, Pressable, StyleSheet } from "react-native";
import ActorDisplayComponent from "../components/ActorDisplay";
import ContentDisplay from "../components/ContentDisplay";
import ElapsedTime from "../components/ElapsedTime";
import SuggestLogin from "../components/SuggestLogin";
import RetryState from "../components/RetryState";
import { Text, View } from "../components/Themed";
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadId, setReloadId] = useState(0);

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
