/*
    Project: Hoot Mobile
    -------------------

    File: MessageThreadScreen.tsx

    Purpose:

        Display and compose a private-message conversation.

    Responsibilities:

        - Gate conversation threads behind the Lotide 0.18 message capability
        - Load messages with a single other user
        - Render messages in chronological order
        - Send replies to the current conversation

    This file intentionally does NOT contain:

        - Conversation-list dismissal controls
        - Notification polling
        - Rich text editing
*/

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { ActorDisplay } from "../components/ActorDisplay";
import ContentDisplay from "../components/ContentDisplay";
import ElapsedTime from "../components/ElapsedTime";
import RetryState from "../components/RetryState";
import SuggestLogin from "../components/SuggestLogin";
import { Text, View } from "../components/Themed";
import { supportsPrivateMessages } from "../constants/LotideApi";
import { MINIMUM_TOUCH_TARGET_SIZE } from "../constants/TouchTargets";
import { useLotideCtx } from "../hooks/useLotideCtx";
import useTheme from "../hooks/useTheme";
import * as LotideService from "../services/LotideService";
import { RootStackScreenProps } from "../types";

export default function MessageThreadScreen({
  route,
}: RootStackScreenProps<"MessageThread">) {
  const ctx = useLotideCtx();
  const theme = useTheme();
  const userId = parseFiniteNumber(route.params?.userId);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loadError, setLoadError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadId, setReloadId] = useState(0);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const canUseMessages = supportsPrivateMessages(ctx?.apiVersion);
  const displayMessages = useMemo(
    () => [...messages].sort(compareMessagesChronologically),
    [messages],
  );
  const latestMessageId = displayMessages[displayMessages.length - 1]?.id;

  useEffect(() => {
    if (!ctx?.login || !canUseMessages || !userId) return;

    let isActive = true;

    LotideService.getPrivateMessageThread(ctx, userId)
      .then(data => {
        if (!isActive) return;
        setMessages(data.items);
        setLoadError("");
        setHasLoaded(true);
      })
      .catch(() => {
        if (!isActive) return;
        setLoadError("Cannot load conversation");
        setHasLoaded(true);
      });

    return () => {
      isActive = false;
    };
  }, [canUseMessages, ctx, reloadId, userId]);

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

  if (!userId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.secondaryText }}>Cannot load conversation</Text>
      </View>
    );
  }

  function refresh() {
    setLoadError("");
    setHasLoaded(false);
    setReloadId(x => x + 1);
  }

  function send() {
    if (!ctx?.login || !draft.trim() || !userId) return;

    setIsSending(true);
    LotideService.sendPrivateMessage(
      ctx,
      userId,
      draft.trim(),
      latestMessageId,
    )
      .then(() => {
        setDraft("");
        refresh();
      })
      .catch(() => {
        Alert.alert("Could not send message");
      })
      .finally(() => setIsSending(false));
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <RetryState compact message={loadError} onRetry={refresh} />
        ) : null}
        {!loadError && !hasLoaded && messages.length === 0 ? (
          <Text style={{ color: theme.secondaryText }}>Loading conversation</Text>
        ) : null}
        {hasLoaded && !loadError && messages.length === 0 ? (
          <Text style={{ color: theme.secondaryText }}>
            No messages in this conversation yet.
          </Text>
        ) : null}
        {displayMessages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            isMine={message.author.id === ctx.login?.user?.id}
          />
        ))}
      </ScrollView>
      <View
        style={[
          styles.composer,
          {
            borderTopColor: theme.secondaryBackground,
            backgroundColor: theme.background,
          },
        ]}
      >
        <TextInput
          accessibilityLabel="Message"
          multiline
          placeholder="Message"
          placeholderTextColor={theme.placeholderText}
          value={draft}
          onChangeText={setDraft}
          style={[
            styles.input,
            {
              borderColor: theme.tertiaryBackground,
              color: theme.text,
            },
          ]}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={isSending || !draft.trim()}
          onPress={send}
          style={[
            styles.sendButton,
            {
              backgroundColor:
                isSending || !draft.trim()
                  ? theme.tertiaryBackground
                  : theme.tint,
            },
          ]}
        >
          <Text style={{ color: "#111827", fontWeight: "600" }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
}: {
  message: PrivateMessage;
  isMine: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.message,
        isMine ? styles.mine : styles.theirs,
        {
          backgroundColor: isMine
            ? theme.secondaryBackground
            : theme.background,
          borderColor: isMine ? theme.tertiaryBackground : theme.secondaryBackground,
        },
      ]}
    >
      <View style={styles.messageHeader}>
        <ActorDisplay
          name={message.author.username}
          host={message.author.host}
          local={message.author.local ?? false}
          showHost="only_foreign"
          colorize="only_foreign"
          userId={message.author.id}
        />
        <ElapsedTime time={message.created} />
      </View>
      <ContentDisplay
        contentHtml={message.content_html}
        contentMarkdown={message.content_markdown}
        contentText={message.content_text}
      />
      {!!message.federation_status && (
        <Text style={{ color: theme.secondaryText, marginTop: 6 }}>
          federation: {message.federation_status}
        </Text>
      )}
    </View>
  );
}

function compareMessagesChronologically(
  left: PrivateMessage,
  right: PrivateMessage,
) {
  const leftTime = Date.parse(left.created);
  const rightTime = Date.parse(right.created);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime || left.id - right.id;
  }

  return left.id - right.id;
}

function parseFiniteNumber(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  message: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth || 1,
    marginBottom: 12,
    maxWidth: "94%",
    padding: 12,
  },
  mine: {
    alignSelf: "flex-end",
  },
  theirs: {
    alignSelf: "flex-start",
  },
  messageHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth || 1,
    padding: 12,
  },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth || 1,
    maxHeight: 140,
    minHeight: 52,
    padding: 12,
    textAlignVertical: "top",
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 10,
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
  },
});

/* end of MessageThreadScreen.tsx */
