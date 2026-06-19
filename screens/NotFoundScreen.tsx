/*
    Project: Hoot Mobile
    -------------------

    File: NotFoundScreen.tsx

    Purpose:

        Render the fallback route for unknown links.

    Responsibilities:

        - Explain that the route is missing
        - Offer navigation back to the root screen

    This file intentionally does NOT contain:

        - deep link configuration
        - error recovery for API calls
*/

import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RootStackScreenProps } from '../types';
import { MINIMUM_TOUCH_TARGET_SIZE } from '../constants/TouchTargets';

export default function NotFoundScreen({ navigation }: RootStackScreenProps<'NotFound'>) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => navigation.replace('Root')}
        style={styles.link}
      >
        <Text style={styles.linkText}>Go to home screen!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    minHeight: MINIMUM_TOUCH_TARGET_SIZE,
    minWidth: 120,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
});

/* end of NotFoundScreen.tsx */
