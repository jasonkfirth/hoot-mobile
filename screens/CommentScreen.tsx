/*
    Project: Hoot Mobile
    -------------------

    File: CommentScreen.tsx

    Purpose:

        Compose a reply to a post or comment.

    Responsibilities:

        - Display the target content context
        - Submit comment markdown
        - Navigate back after posting

    This file intentionally does NOT contain:

        - comment tree rendering
        - post feed loading
*/

import React, { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import AppButton from "../components/AppButton";
import { Text, TextInput } from "../components/Themed";
import useTheme from "../hooks/useTheme";
import { RootStackScreenProps } from "../types";
import * as LotideService from "../services/LotideService";
import ContentDisplay from "../components/ContentDisplay";
import { ScrollView } from "react-native-gesture-handler";
import { useLotideCtx } from "../hooks/useLotideCtx";
import { getErrorMessage } from "../utils/error";

export default function CommentScreen({
  navigation,
  route,
}: RootStackScreenProps<"Comment">) {
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const ctx = useLotideCtx();
  const id = route.params.id;
  const title = route.params.title;
  const html = route.params.html;
  const type = route.params.type;

  function submit() {
    if (!ctx?.login) return;
    const onFailure = (error: unknown) => {
      Alert.alert("Could not submit comment", getErrorMessage(error));
    };

    if (type === "post") {
      LotideService.commentOnPost(ctx, id, text)
        .then(() => navigation.pop())
        .catch(onFailure);
    } else {
      LotideService.commentOnComment(ctx, id, text)
        .then(() => navigation.pop())
        .catch(onFailure);
    }
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView ref={scrollRef}>
        <Pressable
          style={styles.root}
          onPress={() => Platform.OS !== "web" && Keyboard.dismiss()}
        >
          <Text>Reply to {type}</Text>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!html && <ContentDisplay contentHtml={html} />}
          <TextInput
            style={styles.input}
            multiline
            placeholder="Type your comment"
            value={text}
            onChangeText={setText}
            onFocus={scrollToBottom}
          />
          <AppButton title="Submit" color={theme.tint} onPress={submit} fullWidth />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 20, paddingBottom: 100 },
  title: {
    fontSize: 20,
    marginVertical: 10,
  },
  input: {
    marginVertical: 20,
    minHeight: 100,
  },
});

/* end of CommentScreen.tsx */
