/*
    Project: Hoot Mobile
    -------------------

    File: ForgotPasswordScreen.tsx

    Purpose:

        Handle Lotide password reset requests.

    Responsibilities:

        - Request reset keys by email
        - Submit reset key and new password
        - Show recoverable errors

    This file intentionally does NOT contain:

        - login persistence
        - host selection
*/

import React, { useRef, useState } from "react";
import { RootStackScreenProps } from "../types";
import { Text, TextInput, View } from "../components/Themed";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import AppButton from "../components/AppButton";
import useTheme from "../hooks/useTheme";
import * as LotideService from "../services/LotideService";
import { getErrorMessage } from "../utils/error";

export default function ForgotPasswordScreen({
  navigation,
  route,
}: RootStackScreenProps<"ForgotPassword">) {
  const [isAwaitingKey, setIsAwaitingKey] = useState(false);
  const [email, setEmail] = useState("");
  const [validKey, setValidKey] = useState<string>();
  const [password, setPassword] = useState("");
  const keyRequestId = useRef(0);
  const theme = useTheme();

  function submitEmail() {
    if (!email)
      return Alert.alert(
        "Email address required",
        "An email with a password reset key will be emailed to you",
      );
    LotideService.forgotPasswordRequestKey(
      { apiUrl: `https://${route.params.node}/api/unstable` },
      email,
    )
      .then(() => {
        setIsAwaitingKey(true);
      })
      .catch(e => Alert.alert("Failed to send reset key", getErrorMessage(e)));
  }

  function submitPassword() {
    if (!password) return Alert.alert("Password required");
    if (!validKey) return Alert.alert("No key", "Fail. This shouldn't happen");
    LotideService.forgotPasswordReset(
      { apiUrl: `https://${route.params.node}/api/unstable` },
      validKey,
      password,
    )
      .then(() => navigation.popToTop())
      .catch(error => {
        Alert.alert("Failed to reset password", getErrorMessage(error));
      });
  }

  function keyChange(key: string) {
    keyRequestId.current += 1;
    const requestId = keyRequestId.current;
    setValidKey(undefined);

    if (key.length < 6) return;

    LotideService.forgotPasswordTestKey(
      { apiUrl: `https://${route.params.node}/api/unstable` },
      key,
    )
      .then(() => {
        if (requestId === keyRequestId.current) {
          setValidKey(key);
        }
      })
      .catch(() => {
        if (requestId === keyRequestId.current) {
          setValidKey(undefined);
        }
      });
  }

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => Platform.OS !== "web" && Keyboard.dismiss()}
    >
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable>
          <Text>{route.params.node}</Text>
        </Pressable>
        {!isAwaitingKey ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="go"
              autoCapitalize="none"
            />
            <AppButton
              title="Submit"
              onPress={submitEmail}
              color={theme.tint}
              fullWidth
              style={styles.singleButton}
            />
          </>
        ) : (
          <>
            {validKey ? (
              <>
                <TextInput
                  placeholder="New Password"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  secureTextEntry={true}
                  textContentType="password"
                  autoComplete="password"
                />
                <View style={styles.actionButtons}>
                  <AppButton
                    title="Go Back"
                    onPress={() => setIsAwaitingKey(false)}
                    color={theme.secondaryTint}
                    style={styles.actionButton}
                  />
                  <AppButton
                    title="Submit"
                    onPress={submitPassword}
                    color={theme.tint}
                    style={styles.actionButton}
                  />
                </View>
              </>
            ) : (
              <TextInput
                placeholder="Key"
                style={styles.input}
                onChangeText={keyChange}
                autoCapitalize="none"
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  input: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 15,
  },
  actionButtons: {
    alignItems: "center",
    display: "flex",
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginTop: 15,
  },
  actionButton: {
    flexGrow: 1,
  },
  singleButton: {
    marginTop: 15,
  },
});

/* end of ForgotPasswordScreen.tsx */
