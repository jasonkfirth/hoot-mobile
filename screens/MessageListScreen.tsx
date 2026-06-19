/*
    Project: Hoot Mobile
    -------------------

    File: MessageListScreen.tsx

    Purpose:

        Display the Lotide private-message conversation list.

    Responsibilities:

        - Gate the inbox behind the Lotide 0.18 private-message capability
        - Load one preview row per active conversation
        - Open conversation threads
        - Dismiss conversations until new activity arrives

    This file intentionally does NOT contain:

        - Thread-level message composition
        - Notification polling
        - User profile editing
*/

import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet } from "react-native";
import { ActorDisplay } from "../components/ActorDisplay";
import ContentDisplay from "../components/ContentDisplay";
import ElapsedTime from "../components/ElapsedTime";
import RetryState from "../components/RetryState";
import SuggestLogin from "../components/SuggestLogin";
import { Text, View } from "../components/Themed";
import { supportsPrivateMessages } from "../constants/LotideApi";
import {
  MINIMUM_TOUCH_TARGET_SIZE,
  TOUCH_TARGET_HIT_SLOP,
} from "../constants/TouchTargets";
import { useLotideCtx } from "../hooks/useLotideCtx";
import useTheme from "../hooks/useTheme";
import * as LotideService from "../services/LotideService";
import { RootTabScreenProps } from "../types";

export default function MessageListScreen({
  navigation,
}: RootTabScreenProps<"MessageListScreen">) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loadError, setLoadError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadId, setReloadId] = useState(0);
  const canUseMessages = supportsPrivateMessages(ctx?.apiVersion);

  useEffect(
    () => navigation.addListener("focus", () => setReloadId(x => x + 1)),
    [navigation],
  );

  useEffect(() => {
    if (!ctx?.login || !canUseMessages) return;

    let isActive = true;

    LotideService.getPrivateMessageConversations(ctx)
      .then(data => {
        if (!isActive) return;
        setMessages(data.items);
        setLoadError("");
        setHasLoaded(true);
      })
      .catch(() => {
        if (!isActive) return;
        setMessages([]);
        setLoadError("Cannot load messages");
        setHasLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [canUseMessages, ctx, reloadId]);

  if (!ctx?.login) {
    return <SuggestLogin />;
  }

  if (!canUseMessages) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.secondaryText }}>
          This Lotide server does not provide private messages yet.
        </Text>
      </View>
    );
  }

  const loginUserId = ctx.login.user?.id;

  function refresh() {
    setLoadError("");
    setHasLoaded(false);
    setReloadId(x => x + 1);
  }

  function renderItem({ item }: { item: PrivateMessage }) {
    const partner = LotideService.getPrivateMessagePartner(
      item,
      loginUserId,
    );

    return (
      <ConversationRow
        message={item}
        partner={partner}
        onOpen={() =>
          navigation.navigate("MessageThread", {
            userId: partner.id,
            username: partner.username,
          })
        }
        onDismiss={refresh}
      />
    );
  }

  return (
    <FlatList
      style={[styles.root, { backgroundColor: theme.background }]}
      data={messages}
      keyExtractor={item => String(item.id)}
      renderItem={renderItem}
      refreshing={false}
      onRefresh={refresh}
      ListEmptyComponent={
        hasLoaded ? (
          <View style={styles.empty}>
            {loadError ? (
              <RetryState compact message={loadError} onRetry={refresh} />
            ) : (
              <Text style={{ color: theme.secondaryText }}>No messages yet</Text>
            )}
          </View>
        ) : null
      }
    />
  );
}

function ConversationRow({
  message,
  partner,
  onOpen,
  onDismiss,
}: {
  message: PrivateMessage;
  partner: Profile;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const sentByMe = message.author.id === ctx?.login?.user?.id;

  function dismiss() {
    if (!ctx?.login) return;

    LotideService.dismissPrivateMessageConversation(ctx, partner.id)
      .then(onDismiss)
      .catch(() => {
        Alert.alert("Could not dismiss conversation");
      });
  }

  return (
    <Pressable
      accessibilityLabel={`Open conversation with ${partner.username}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={[
        styles.row,
        {
          borderBottomColor: theme.secondaryBackground,
        },
      ]}
    >
      <View style={styles.rowHeader}>
        <ActorDisplay
          name={partner.username}
          host={partner.host}
          local={partner.local ?? false}
          showHost="only_foreign"
          colorize="only_foreign"
          userId={partner.id}
        />
        <ElapsedTime time={message.created} />
      </View>
      <Text style={{ color: theme.secondaryText, marginTop: 6 }}>
        {sentByMe ? "You: " : ""}
      </Text>
      <ContentDisplay
        contentHtml={message.content_html}
        contentMarkdown={message.content_markdown}
        contentText={message.content_text}
        maxChars={220}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Dismiss conversation with ${partner.username}`}
          accessibilityRole="button"
          hitSlop={TOUCH_TARGET_HIT_SLOP}
          onPress={dismiss}
          style={[
            styles.dismissButton,
            { backgroundColor: theme.secondaryBackground },
          ]}
        >
          <Text style={{ color: theme.text }}>Dismiss</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth || 1,
    padding: 16,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actions: {
    alignItems: "flex-start",
    marginTop: 12,
  },
  dismissButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  empty: {
    padding: 24,
  },
});

/* end of MessageListScreen.tsx */
