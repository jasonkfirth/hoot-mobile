# Hoot Mobile

Hoot Mobile is a React Native / Expo client for Lotide servers. It lets a
phone connect to a Lotide instance, browse communities, read and submit posts,
reply to comments, manage followed communities, view notifications, and use
profile and moderation flows.

This application is not a social platform by itself. It is a mobile frontend
for the Lotide federated community server API.

The app is still pre-alpha. Please file bugs and feature requests in the
project issue tracker.

## Current State

The current tree is a large update from the older Expo 48 app. The app now
targets Expo SDK 56, React 19, React Native 0.85, React Navigation 7, Redux
Toolkit 2, TypeScript 6, and the current Expo module set that validates with
the Android release build.

Notable current features:

  * Lotide feed, post, comment, community, profile, notification, user activity,
    and moderation screens.
  * Mine / Everything community browsing backed by the current Lotide
    community list API.
  * Runtime validation and normalization for Lotide API responses.
  * Current HTML rendering through react-native-render-html.
  * Android local notification polling through expo-background-task,
    expo-task-manager, and expo-notifications.
  * Native Android project files under android/.
  * Debian Android build and emulator smoke-test helpers under build_scripts/.
  * Jest, ESLint, TypeScript, npm audit, and Android release-build validation.

See changelog.txt for the detailed 0.2.0 change list.

## Screenshots

These screenshots are from an older build and may not match the current UI.

||||
| --- | --- | --- |
| Feed         | Community     | Post            |
| ![image][1]  | ![image][2]   | ![image][3]     |
| New Post     | Notifications | Content Preview |
| ![image][4]  | ![image][5]   | ![image][6]     |

[1]: https://user-images.githubusercontent.com/12021069/137040267-6295b881-9be4-447d-a17a-4b7ec5967c1a.png
[2]: https://user-images.githubusercontent.com/12021069/137040537-3d4fb5c3-2da2-43ec-ad10-ebadb500779c.png
[3]: https://user-images.githubusercontent.com/12021069/137040627-5268163d-e89e-446c-bd03-57d9e25c049a.png
[4]: https://user-images.githubusercontent.com/12021069/137040716-8c5fe8c3-45ad-4ebb-abe4-bd57a0869c4a.png
[5]: https://user-images.githubusercontent.com/12021069/137040813-519ca891-79c5-473a-9663-3c1d5966da2b.png
[6]: https://user-images.githubusercontent.com/12021069/137040918-10146e69-f0aa-4d8d-811a-d32a321bf1ce.png

## Requirements

For normal JavaScript development:

  * Node.js 20.x or newer.
  * npm. The repository uses package-lock.json for reproducible installs.

For local Android builds:

  * OpenJDK 17.
  * Android command-line tools, platform-tools, and build tools.
  * The Android SDK available through ANDROID_HOME, ANDROID_SDK_ROOT,
    ~/Android/Sdk, or ~/android-sdk.

The Debian build helper can install or set up many of the Android build
dependencies when apt-get and sudo are available. If sudo is not available, it
prints the packages that need to be installed manually.

## Install

Install the JavaScript dependencies with npm:

```bash
npm ci
```

If npm reports peer-dependency noise while repairing an older checkout, use the
same path as the build script:

```bash
npm ci --legacy-peer-deps
```

## Development

Start the Expo development server:

```bash
npm start
```

Run on Android through the local native project:

```bash
npm run android
```

Run the web development server:

```bash
npm run web
```

Run the iOS target from a supported macOS environment:

```bash
npm run ios
```

The Android and iOS scripts use expo run:* instead of the older Expo Go style
commands because the app now has native module requirements and an android/
project.

## Validation

Run the main validation commands before committing:

```bash
npm run lint:strict
npm test
npm audit --audit-level=moderate
npx expo install --check
```

The strict lint command runs ESLint with unused-disable reporting, checks
Git-visible text files for whitespace/newline/conflict-marker problems, and
runs TypeScript in no-emit mode.

The test script runs Jest once by default. To run Jest in watch mode:

```bash
npm run test:watch
```

## Android Build Scripts

The build_scripts/ directory contains Debian-focused helpers for local Android
release builds and emulator smoke checks.

Build an APK:

```bash
npm run build:android
```

That command runs:

```bash
./build_scripts/debian-build-hoot-mobile-android.sh
```

The build script:

  * installs baseline Debian packages when apt-get is available;
  * selects a Java 17 JDK when one is installed;
  * sets ANDROID_HOME to ~/android-sdk by default;
  * installs Android command-line tools if needed;
  * runs npm ci, falling back to npm install if configured to do so;
  * runs expo prebuild --platform android --no-install;
  * builds the release APK with Gradle.

The expected APK output directory is:

```text
android/app/build/outputs/apk/release/
```

The build script recognizes these environment variables:

```text
HOOT_MOBILE_NODE_ENV
HOOT_MOBILE_BUILD_NO_DEV_DEPS
HOOT_MOBILE_NPM_FALLBACK_INSTALL
```

Smoke-test an APK on an emulator:

```bash
./build_scripts/debian-test-hoot-mobile-android.sh
```

You can also pass an APK path explicitly:

```bash
./build_scripts/debian-test-hoot-mobile-android.sh android/app/build/outputs/apk/release/app-release.apk
```

The emulator helper:

  * finds the Android SDK from ANDROID_SDK_ROOT, ANDROID_HOME, ~/Android/Sdk,
    or ~/android-sdk;
  * installs emulator dependencies when apt-get is available;
  * creates an Android 34 Google APIs x86_64 AVD named HootTest;
  * installs the APK with adb;
  * launches org.brokenlamp.hoot with monkey.

Set HOOT_MOBILE_KEEP_EMULATOR=1 to leave the emulator running after the script
finishes.

## Android Project Files

The android/ directory is now part of the project state. It contains the native
React Native Android project for package org.brokenlamp.hoot. Build outputs are
ignored:

```text
android/.gradle/
android/build/
android/app/build/
android/**/.cxx/
```

Do not commit generated Gradle build output or local Android SDK files. Commit
intentional native source/configuration changes under android/.

## Notifications

Android background notifications are local polling notifications. They are
enabled from the app settings screen, require OS notification permission, and
run when Android allows the background task to execute.

The app keeps a per-account local notification baseline so a notification can
still be shown on the phone even if another Lotide client has already fetched
the notification endpoint. This is not server push. If the app is force-killed,
the operating system may not run the background task.

## Web Output

The app still supports Expo web development through Metro:

```bash
npm run web
```

Generated static web output, when present, lives under dist/. The current
repository state includes dist/ files for deployment, but they are generated
artifacts rather than source code.

## Repository Map

Important paths:

```text
android/                         native Android project
app.json                         Expo app metadata
build_scripts/                   Debian Android build/test helpers
changelog.txt                    release notes
components/                      shared React Native components
hooks/                           app hooks
navigation/                      navigation and deep-link configuration
screens/                         app screens
scripts/                         local validation helper scripts
services/LotideService/          Lotide API client and response validation
services/LotideNotificationPoller.ts
                                 Android notification polling
slices/                          Redux slices
store/                           Redux store setup
types.d.ts                       shared Lotide ambient types
```

## Package Notes

Some package versions are intentionally held at the Expo SDK 56 compatible
versions even when npm reports newer registry releases. The Android release
build is the compatibility gate for those packages.

The project currently holds Babel on the latest 7.x line because the current
Metro/worklets path still loads Babel 7 preset code.

## License

Hoot Mobile is licensed under the GNU General Public License, version 3. See
LICENSE for details.
