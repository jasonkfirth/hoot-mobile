/*
    Project: Hoot Mobile
    -------------------

    File: Login.tsx

    Purpose:

        Collect Lotide login credentials for a selected host.

    Responsibilities:

        - Submit username and password to the Lotide login API
        - Persist successful login context
        - Offer registration and password reset navigation

    This file intentionally does NOT contain:

        - host selection
        - global app bootstrapping
*/

import React, { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput as DefaultTextInput,
} from "react-native";
import AppButton from "./AppButton";
import { Text, TextInput, View } from "./Themed";
import * as LotideService from "../services/LotideService";
import useTheme from "../hooks/useTheme";
import { useNavigation } from "@react-navigation/core";
import { useDispatch } from "react-redux";
import { setCtx } from "../slices/lotideSlice";
import { getErrorMessage } from "../utils/error";
import { RootStackScreenProps } from "../types";
import { TOUCH_TARGET_HIT_SLOP } from "../constants/TouchTargets";

export interface LoginProps {
  hostName?: string;
  domain: string;
  username?: string;
  onGoBack: () => void;
}

export default function Login(props: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState(props.username || "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const usernameRef = useRef<DefaultTextInput>(null);
  const passwordRef = useRef<DefaultTextInput>(null);
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation<RootStackScreenProps<"ForgotPassword">["navigation"]>();

  function fail(message: string) {
    Alert.alert("Failed to submit", message);
  }

  function register() {
    if (!username) return fail("Please enter a username");
    if (!password) return fail("Enter a password");
    if (!email) return fail("Please enter an email address");

    LotideService.register(
      `https://${props.domain}/api/unstable`,
      username,
      password,
      email,
    )
      .then(data => {
        dispatch(
          setCtx({
            apiUrl: `https://${props.domain}/api/unstable`,
            login: data,
          }),
        );
      })
      .catch(e => {
        Alert.alert("Failed to register", getErrorMessage(e));
      });
  }

  function login() {
    if (!username) return fail("Please enter a username");
    if (!password) return fail("Enter a password");

    LotideService.login(
      `https://${props.domain}/api/unstable`,
      username,
      password,
    )
      .then(data => {
        dispatch(
          setCtx({
            apiUrl: `https://${props.domain}/api/unstable`,
            login: data,
          }),
        );
      })
      .catch(e => {
        Alert.alert("Failed to login", getErrorMessage(e));
      });
  }

  function submit() {
    if (isRegistering) {
      register();
    } else {
      login();
    }
  }

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => Platform.OS !== "web" && Keyboard.dismiss()}
    >
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        {props.hostName ? (
          <Pressable style={{ alignItems: "center" }}>
            <Text style={styles.name}>{props.hostName}</Text>
            <Text style={[styles.domain, { color: theme.secondaryText }]}>
              {props.domain}
            </Text>
          </Pressable>
        ) : (
          <Pressable>
            <Text style={{ fontSize: 24 }}>{props.domain}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityLabel={
            isRegistering ? "Switch to login" : "Switch to registration"
          }
          accessibilityRole="button"
          hitSlop={TOUCH_TARGET_HIT_SLOP}
          onPress={() => setIsRegistering(x => !x)}
        >
          <Text style={[styles.loginRegister, { color: theme.secondaryText }]}>
            <Text
              style={{
                color: isRegistering
                  ? theme.secondaryText
                  : theme.secondaryTint,
              }}
            >
              Login
            </Text>
            {" | "}
            <Text
              style={{
                color: isRegistering
                  ? theme.secondaryTint
                  : theme.secondaryText,
              }}
            >
              Register
            </Text>
          </Text>
        </Pressable>
        {isRegistering && (
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
          />
        )}
        <TextInput
          ref={usernameRef}
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          keyboardType="ascii-capable"
          textContentType="username"
          autoComplete="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
          textContentType={isRegistering ? "newPassword" : "password"}
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {!isRegistering && (
          <Pressable
            style={{ padding: 15 }}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("ForgotPassword", {
                node: props.domain,
              })
            }
          >
            <Text secondary>Forgot Password</Text>
          </Pressable>
        )}
        <View style={styles.actionButtons}>
          <AppButton
            title="Change Host"
            onPress={props.onGoBack}
            color={theme.secondaryTint}
            style={styles.actionButton}
          />
          <AppButton
            title={isRegistering ? "Register" : "Login"}
            onPress={submit}
            color={theme.tint}
            style={styles.actionButton}
          />
        </View>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 35,
  },
  name: {
    fontSize: 50,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  domain: {
    fontWeight: "300",
  },
  loginRegister: {
    padding: 15,
  },
  input: {
    width: "100%",
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionButtons: {
    width: "100%",
    alignItems: "center",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  actionButton: {
    flexGrow: 1,
  },
});

/* end of Login.tsx */
