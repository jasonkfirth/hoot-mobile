/*
    Project: Hoot Mobile
    -------------------

    File: HostList.tsx

    Purpose:

        Render known and stored Lotide hosts for login.

    Responsibilities:

        - Probe seeded hosts for instance metadata
        - List stored account profiles
        - Select custom or known host domains

    This file intentionally does NOT contain:

        - login form fields
        - network discovery beyond the seeded list
*/

import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet } from "react-native";
import Icon from "@expo/vector-icons/Ionicons";
import KnownHosts from "../constants/KnownHosts";
import ActorDisplayComponent from "./ActorDisplay";
import { Text, TextInput, View } from "./Themed";
import * as LotideService from "../services/LotideService";
import useTheme from "../hooks/useTheme";
import { lotideContextKV } from "../services/StorageService";
import { setCtx } from "../slices/lotideSlice";
import { useDispatch } from "react-redux";
import ContentDisplay from "./ContentDisplay";
import RetryState from "./RetryState";
import { MINIMUM_LOTIDE_API_VERSION } from "../constants/LotideApi";
import { MINIMUM_TOUCH_TARGET_SIZE } from "../constants/TouchTargets";

export interface HostListProps {
  onSelect: (domain: string, name?: string, username?: string) => void;
}

interface HostData {
  name: string;
  domain: string;
  instanceInfo?: InstanceInfo | null;
}

export default function HostList(props: HostListProps) {
  const [hostText, setHostText] = useState("");
  const [knownHosts, setKnowHosts] = useState<HostData[]>(KnownHosts);
  const [existingProfiles, setExistingProfiles] = useState<
    [string, LotideContext][]
  >([]);
  const theme = useTheme();
  const dispatch = useDispatch();

  const loadKnownHostInfo = useCallback((host: HostData, index: number) => {
    LotideService.getInstanceInfo({
      apiUrl: `https://${host.domain}/api/unstable`,
    })
      .then(instanceInfo => {
        setKnowHosts(hosts =>
          hosts.map((hostData, hostIndex) =>
            index !== hostIndex
              ? hostData
              : {
                name: hostData.name,
                domain: hostData.domain,
                instanceInfo,
              },
          ),
        );
      })
      .catch(() => {
        setKnowHosts(hosts =>
          hosts.map((hostData, hostIndex) =>
            index !== hostIndex
              ? hostData
              : {
                name: hostData.name,
                domain: hostData.domain,
                instanceInfo: null,
              },
          ),
        );
      });
  }, []);

  useEffect(() => {
    KnownHosts.forEach(loadKnownHostInfo);
  }, [loadKnownHostInfo]);

  useEffect(() => {
    lotideContextKV
      .getStore()
      .then(object => Object.entries(object))
      .then(setExistingProfiles);
  }, []);

  const renderItem = ({ item, index }: { item: HostData; index: number }) => {
    const enabled =
      (item.instanceInfo?.apiVersion || 0) >= MINIMUM_LOTIDE_API_VERSION;
    const color = enabled ? theme.text : theme.secondaryText;
    const description = item.instanceInfo?.description;
    return (
      <View
        style={{
          borderBottomWidth: StyleSheet.hairlineWidth || 1,
          borderColor: theme.secondaryText,
          paddingVertical: 25,
        }}
      >
        <Pressable
          accessibilityLabel={`Select host ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={() => props.onSelect(item.domain, item.name)}
        >
          <ActorDisplayComponent
            name={item.name}
            host={item.domain}
            local={false}
            newLine={true}
            styleName={{
              fontSize: 24,
              fontWeight: "300",
              fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
              color,
            }}
          />
          {item.instanceInfo ? (
            <>
              <Text style={{ color: theme.secondaryText }}>
                {item.instanceInfo.software.name}{" "}
                {item.instanceInfo.software.version}
                {!enabled && " - Out of date"}
              </Text>
              {!!description &&
                (typeof description === "string" ? (
                  <Text style={{ color }}>{description}</Text>
                ) : (
                  <ContentDisplay
                    contentHtml={description.content_html}
                    contentMarkdown={description.content_markdown}
                    contentText={description.content_text}
                  />
                ))}
            </>
          ) : item.instanceInfo === null ? null : (
            <Text style={{ color }}>Loading...</Text>
          )}
        </Pressable>
        {item.instanceInfo === null ? (
          <RetryState
            compact
            actionLabel="Retry host"
            message="Failed to load info"
            onRetry={() => loadKnownHostInfo(item, index)}
            style={styles.hostRetry}
          />
        ) : null}
      </View>
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Login to continue</Text>
      {existingProfiles.length > 0 && (
        <Text style={styles.subtitle}>Select an existing profile</Text>
      )}
      {existingProfiles.map(p => {
        const [username, url] = p[0].split("@");
        const isUnlocked = !!p[1].login;
        const color = isUnlocked ? theme.text : theme.secondaryText;
        const host = url
          .replace("http://", "")
          .replace("https://", "")
          .split(/[/?#]/)[0];
        const hostName = KnownHosts.find(x => x.domain === host)?.name;
        return (
          <Pressable
            key={p[0]}
            accessibilityLabel={`Select profile ${username}@${host}`}
            accessibilityRole="button"
            onPress={() => {
              if (isUnlocked) {
                dispatch(setCtx(p[1]));
              } else {
                props.onSelect(host.toLowerCase(), undefined, username);
              }
            }}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              minHeight: MINIMUM_TOUCH_TARGET_SIZE,
            }}
          >
            <Icon
              name={isUnlocked ? "lock-open-outline" : "lock-closed-outline"}
              color={color}
              style={{ marginRight: 10 }}
              size={20}
            />
            <ActorDisplayComponent
              name={username}
              host={host}
              local={true}
              showHost={"always"}
              newLine={true}
              style={{ paddingVertical: 15, paddingBottom: 10 }}
              styleName={{ color }}
            />
            <View style={{ flex: 1 }} />
            <Text
              style={{
                fontSize: 16,
                color,
                fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
              }}
            >
              {hostName}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.subtitle}>
        {existingProfiles.length > 0
          ? "Or sign into a new account"
          : "Enter a host or select one below"}
      </Text>
      <TextInput
        placeholder="Host domain"
        style={styles.hostInput}
        value={hostText}
        onChangeText={setHostText}
        onSubmitEditing={() => props.onSelect(hostText.toLowerCase())}
        keyboardType="url"
        returnKeyType="next"
      />
      {knownHosts
        .filter(
          x =>
            hostText === "" ||
            x.domain.includes(hostText.toLowerCase()) ||
            x.name.toLowerCase().includes(hostText.toLowerCase()),
        )
        .map((item, index) => (
          <View key={item.domain}>{renderItem({ item, index })}</View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontWeight: "300",
    marginBottom: 10,
    marginTop: 15,
    textAlign: "center",
  },
  hostRetry: {
    marginTop: 10,
  },
  hostInput: {
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});

/* end of HostList.tsx */
