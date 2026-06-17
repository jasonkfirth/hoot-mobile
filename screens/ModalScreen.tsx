/*
    Project: Hoot Mobile
    -------------------

    File: ModalScreen.tsx

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
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
          <Icon name="bookmark-outline" size={25} color={theme.text} />
          <Pressable
            hitSlop={5}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate("Comment", {
                id: post.id,
                title: post.title,
                html: post.content_html ?? "",
                type: "post",
              });
            }}
          >
            <Icon name="arrow-undo-outline" size={25} color={theme.text} />
          </Pressable>
          <Pressable
            hitSlop={5}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Share.share({
                message: post.title,
                url: `https://dev.goldandblack.xyz/p/posts/${post.id}`,
                title: "Hoot",
              });
            }}
          >
            <Icon name="share-outline" size={25} color={theme.text} />
          </Pressable>
        </View>
        {highlightedComments && (
          <Pressable onPress={() => setHighlightedComments(undefined)}>
            <Text style={{ color: theme.tint, paddingVertical: 10 }}>
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
});

/* end of ModalScreen.tsx */
