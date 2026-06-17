/*
    Project: Hoot Mobile
    -------------------

    File: CommunityFinder.tsx

    Purpose:

        System file for Hoot Mobile.

    Responsibilities:

        • Part of the Hoot Mobile ecosystem
*/

import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/Ionicons";
import * as LotideService from "../services/LotideService";
import ActorDisplayComponent from "./ActorDisplay";
import ContentDisplay from "./ContentDisplay";
import useTheme from "../hooks/useTheme";
import { useLotideCtx } from "../hooks/useLotideCtx";

export interface CommunityFinderProps {
  placeholder?: string;
  onlyWhenTyping?: boolean;
  onlyFollowing?: boolean;
  focusId?: number;
  onSelect: (community: Community) => void;
}

export default function CommunityFinder(props: CommunityFinderProps) {
  const [communities, setCommunities] = useState<Paged<Community>>();
  const [filterText, setFilterText] = useState("");
  const ctx = useLotideCtx();
  const theme = useTheme();

  const communitiesToDisplay = (() => {
    if (props.onlyWhenTyping && filterText === "") return [];
    if (!communities) return [];
    if (filterText === "") return communities.items;
    return communities.items.filter(c =>
      c.name.toLowerCase().includes(filterText.toLowerCase()),
    );
  })();

  useEffect(() => {
    if (!ctx) return;
    LotideService.getCommunities(ctx, props.onlyFollowing || false)
      .then(setCommunities)
      .catch(() => {
        setCommunities({
          items: [],
          next_page: null,
        });
      });
  }, [ctx, props.focusId, props.onlyFollowing]);

  const renderItem = ({ item }: { item: Community }) => {
    const description = item.description;
    const descriptionText = typeof description === "string" ? description : "";
    const descriptionMarkdown =
      description && typeof description !== "string" ? description.content_markdown : "";
    const descriptionHtml =
      description && typeof description !== "string" ? description.content_html : "";
    const truncatedDescription =
      descriptionText && descriptionText.length > 120
        ? `${descriptionText.substring(0, 120)}...`
        : descriptionText;

    return (
      <Pressable
        accessibilityLabel={`Select community ${item.name}@${item.host}`}
        accessibilityRole="button"
        onPress={() => props.onSelect(item)}
        style={[
          styles.item,
          {
            borderColor: theme.tertiaryBackground,
          },
        ]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <ActorDisplayComponent
            name={item.name}
            host={item.host}
            local={item.local}
            colorize={"always"}
            newLine
          />
          <View style={{ display: "flex", flexDirection: "row" }}>
            {item.you_are_moderator && (
              <Icon
                name="shield-outline"
                size={20}
                color={theme.secondaryTint}
              />
            )}
            {item.your_follow?.accepted && (
              <Icon
                name="checkmark"
                size={20}
                color={theme.secondaryTint}
                style={{ marginLeft: 5 }}
              />
            )}
          </View>
        </View>
        {!!descriptionText && (
          <Text style={{ color: theme.secondaryText, marginTop: 10 }}>
            {truncatedDescription}
          </Text>
        )}
        {description && typeof description !== "string" && (
          <View style={{ marginTop: 10 }}>
            {!!(descriptionHtml || descriptionMarkdown || description.content_text) && (
              <ContentDisplay
                contentHtml={descriptionHtml}
                contentMarkdown={descriptionMarkdown}
                contentText={description.content_text}
                maxChars={120}
              />
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <FlatList
      data={communitiesToDisplay}
      renderItem={renderItem}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      contentContainerStyle={styles.list}
      stickyHeaderIndices={[0]}
      style={{ backgroundColor: theme.background }}
      ListHeaderComponent={
        <View style={{ backgroundColor: theme.background, padding: 15 }}>
          <TextInput
            placeholder={props.placeholder || "Filter communities"}
            placeholderTextColor={theme.placeholderText}
            value={filterText}
            onChangeText={setFilterText}
            style={[styles.input, { color: theme.text }]}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  input: {
    marginHorizontal: 25,
    paddingVertical: 10,
  },
  list: {
    paddingBottom: 50,
  },
  item: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "stretch",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth || 1,
    paddingHorizontal: 20,
    marginHorizontal: 20,
  },
});

/* end of CommunityFinder.tsx */
