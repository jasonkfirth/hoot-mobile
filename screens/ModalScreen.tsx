/*
    Project: Hoot Mobile
    -------------------

    File: ModalScreen.tsx

    Purpose:

        Show a post detail page with comments.

    Responsibilities:

        - Load the selected post
        - Render post actions and comment tree
        - Highlight comments from notification routes

    This file intentionally does NOT contain:

        - feed pagination
        - post submission
*/

import Icon from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import {
  StyleSheet,
  StatusBar,
  ScrollView,
  Pressable,
  Share,
} from "react-native";
import * as Haptics from "../services/HapticService";
import PostDisplay from "../components/PostDisplay";
import { View, Text } from "../components/Themed";
import useTheme from "../hooks/useTheme";
import { RootStackScreenProps } from "../types";
import CommentsDisplay from "../components/CommentsDisplay";
import usePost from "../hooks/usePost";
import RetryState from "../components/RetryState";
import { useLotideCtx } from "../hooks/useLotideCtx";
import { MINIMUM_TOUCH_TARGET_SIZE, TOUCH_TARGET_HIT_SLOP } from "../constants/TouchTargets";

export default function ModalScreen({
  navigation,
  route,
}: RootStackScreenProps<"Post" | "Modal">) {
  const postId = route.params.postId;
  const [postReloadId, setPostReloadId] = useState(0);
  const post = usePost(postId, postReloadId);
  const [highlightedComments, setHighlightedComments] = useState(
    route.params.highlightedComments,
  );
  const theme = useTheme();
  const ctx = useLotideCtx();

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RetryState
          message="Cannot load post"
          onRetry={() => setPostReloadId(x => x + 1)}
        />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }}>
      <View
        style={{
          ...styles.item,
          backgroundColor: theme.background,
        }}
      >
        <PostDisplay postId={post.id} navigation={navigation} showAuthor />
        <View style={styles.actions}>
          <View style={styles.iconButton}>
            <Icon name="bookmark-outline" size={25} color={theme.text} />
          </View>
          <Pressable
            accessibilityLabel="Reply to post"
            accessibilityRole="button"
            hitSlop={TOUCH_TARGET_HIT_SLOP}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("Comment", {
                id: post.id,
                title: post.title,
                html: post.content_html ?? "",
                type: "post",
              });
            }}
            style={styles.iconButton}
          >
            <Icon name="arrow-undo-outline" size={25} color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Share post"
            accessibilityRole="button"
            hitSlop={TOUCH_TARGET_HIT_SLOP}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const shareUrl = getPostShareUrl(post, ctx?.apiUrl);
              Share.share({
                message: shareUrl ? `${post.title}\n${shareUrl}` : post.title,
                url: shareUrl,
                title: "Hoot",
              });
            }}
            style={styles.iconButton}
          >
            <Icon name="share-outline" size={25} color={theme.text} />
          </Pressable>
        </View>
        {highlightedComments && (
          <Pressable
            accessibilityLabel="Show all comments"
            accessibilityRole="button"
            onPress={() => setHighlightedComments(undefined)}
            style={styles.showAllComments}
          >
            <Text style={{ color: theme.tint }}>
              Show all comments
            </Text>
          </Pressable>
        )}
        <CommentsDisplay
          parentType="post"
          parentId={post.id}
          navigation={navigation}
          postId={post.id}
          highlightedComments={highlightedComments}
        />
        <View style={{ height: 300 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: StatusBar.currentHeight || 0,
  },
  item: {
    marginVertical: 0,
    marginHorizontal: 0,
  },
  title: {
    fontSize: 20,
    padding: 15,
  },
  contentText: {
    fontSize: 12,
  },
  link: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#88888844",
    borderRadius: 5,
    marginHorizontal: 15,
  },
  image: {
    width: "100%",
    height: undefined,
    resizeMode: "contain",
  },
  foot: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: 15,
    borderBottomColor: "#88888844",
    borderBottomWidth: 2,
  },
  by: {
    fontSize: 11,
  },
  actions: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 10,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    minWidth: MINIMUM_TOUCH_TARGET_SIZE,
  },
  showAllComments: {
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    paddingHorizontal: 15,
  },
});

function getPostShareUrl(post: Post, apiUrl?: string): string | undefined {
  if (post.remote_url) return post.remote_url;
  if (!apiUrl) return undefined;

  const baseUrl = apiUrl.replace(/\/api\/unstable\/?$/, "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(baseUrl)) return undefined;

  return `${baseUrl}/p/posts/${post.id}`;
}

/* end of ModalScreen.tsx */
