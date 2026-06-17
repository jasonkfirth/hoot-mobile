/*
    Project: Hoot Mobile
    -------------------

    File: SettingsScreen.tsx

    Purpose:

        Provides a user interface for configuring application settings,
        such as the Lotide API URL and default feed sorting.

    Responsibilities:

        • Display and edit the API URL in the Lotide context
        • Configure default sorting preferences
        • Persist settings changes to local storage and Redux state

    This file intentionally does NOT contain:

        • User profile management (see ProfileScreen.tsx)
        • Direct API requests (other than context updates)
*/

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  Alert,
  Button,
  ScrollView,
  Platform,
  Switch,
} from "react-native";
import { View, Text } from "../../components/Themed";
import useTheme from "../../hooks/useTheme";
import { useLotideCtx } from "../../hooks/useLotideCtx";
import { useDispatch } from "react-redux";
import { setCtx } from "../../slices/lotideSlice";
import * as StorageService from "../../services/StorageService";
import * as LotideNotificationPoller from "../../services/LotideNotificationPoller";

/* ------------------------------------------------------------------------- */
/* Settings Screen Component                                                 */
/* ------------------------------------------------------------------------- */

export default function SettingsScreen() {
  const theme = useTheme();
  const ctx = useLotideCtx();
  const dispatch = useDispatch();

  const [apiUrl, setApiUrl] = useState(ctx?.apiUrl || "https://narwhal.city/api/unstable");
  const [notificationEnabled, setNotificationEnabledState] = useState(false);
  const [updatingNotificationSetting, setUpdatingNotificationSetting] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    LotideNotificationPoller.getNotificationEnabled().then(setNotificationEnabledState);
  }, []);

  /* ------------------------------------------------------------------------- */
  /* Actions                                                                   */
  /* ------------------------------------------------------------------------- */

  /**
      Saves the updated API URL and persists it to storage.
  */
  const handleSave = async () => {
    if (!apiUrl.startsWith("http")) {
      Alert.alert("Invalid URL", "API URL must start with http:// or https://");
      return;
    }

    try {
      const newCtx = { ...ctx, apiUrl };
      await StorageService.lotideContext.store(newCtx);
      dispatch(setCtx(newCtx));
      Alert.alert("Success", "Settings saved successfully");
    } catch {
      Alert.alert("Error", "Failed to save settings");
    }
  };

  const handleNotificationSettingChange = async (nextValue: boolean) => {
    if (Platform.OS !== "android") return;
    setUpdatingNotificationSetting(true);

    try {
      let next = nextValue;
      if (nextValue) {
        const granted = await LotideNotificationPoller.requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            "Cannot enable notifications",
            "Allow notifications in system settings to enable Lotide background alerts.",
          );
          next = false;
        }
      }

      await LotideNotificationPoller.setNotificationEnabled(next, ctx ?? undefined);
      setNotificationEnabledState(next);
    } finally {
      setUpdatingNotificationSetting(false);
    }
  };

  /* ------------------------------------------------------------------------- */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------- */

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={styles.header}>SERVER SETTINGS</Text>
        <Text style={[styles.label, { color: theme.secondaryText }]}>Lotide API URL</Text>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.secondaryBackground,
              borderColor: theme.tertiaryBackground
            }
          ]}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://narwhal.city/api/unstable"
          placeholderTextColor={theme.placeholderText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={[styles.hint, { color: theme.secondaryText }]}>
          Changes the Lotide node your app connects to. Defaults to narwhal.city.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.header}>FEED SETTINGS</Text>
        <View style={styles.row}>
          <Text style={{ color: theme.text }}>Default Sort</Text>
          <Text style={{ color: theme.secondaryText }}>Hot (Static)</Text>
        </View>
      </View>

      {Platform.OS === "android" ? (
        <View style={styles.section}>
          <Text style={styles.header}>NOTIFICATIONS</Text>
          <View style={styles.row}>
            <Text style={{ color: theme.text }}>Background notifications</Text>
            <Switch
              value={notificationEnabled}
              onValueChange={handleNotificationSettingChange}
              disabled={updatingNotificationSetting}
            />
          </View>
          <Text style={[styles.hint, { color: theme.secondaryText }]}>
            Checks Lotide in the background when the operating system allows it
            and shows local alerts for notifications this phone has not already
            surfaced.
          </Text>
        </View>
      ) : null}

      <View style={styles.buttonContainer}>
        <Button title="Save Changes" onPress={handleSave} color={theme.tint} />
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------------- */
/* Styles                                                                    */
/* ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    marginLeft: 5,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cccccc",
  },
  buttonContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  }
});

/* end of SettingsScreen.tsx */
