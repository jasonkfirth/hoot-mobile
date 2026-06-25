# Compiling on Android

Hoot Mobile now uses a checked-in React Native Android project under
android/. The app requires native Expo modules, so the old Expo Go workflow is
not the release path anymore.

## Development Launch

Use the local native project when running on an attached Android device or
emulator:

```bash
npm ci
npm run android
```

The npm script runs through build_scripts/android-env.sh. That wrapper selects
a Java 17 JDK, finds the Android SDK and AVD directory, sets
NODE_ENV=development when needed, and then runs expo run:android.

## Release APK

Build the local release APK with:

```bash
npm run build:android
```

The build helper does not install Debian host packages unless
HOOT_MOBILE_INSTALL_SYSTEM_DEPS=1 is set. Missing Node.js or Java 17 is reported
as an environment problem to fix explicitly.

The APK is written under:

```text
android/app/build/outputs/apk/release/
```

## Smoke Test

After building, smoke-test the APK on an attached phone or an already running
emulator:

```bash
./build_scripts/android-smoke-launch.sh android/app/build/outputs/apk/release/app-release.apk
```

The smoke helper installs the APK, launches org.brokenlamp.hoot, waits for the
app to become the focused activity, and fails if fresh Android or React Native
crash output appears in logcat. It also verifies that the installed package
requests android.permission.POST_NOTIFICATIONS and reports the Android 13+
runtime grant state.

For notification testing on a fresh emulator, you can opt in to granting the
runtime permission before launch:

```bash
HOOT_MOBILE_GRANT_NOTIFICATIONS=1 \
  ./build_scripts/android-smoke-launch.sh android/app/build/outputs/apk/release/app-release.apk
```

To create and use a managed emulator for the same smoke validation:

```bash
./build_scripts/debian-test-hoot-mobile-android.sh android/app/build/outputs/apk/release/app-release.apk
```

The managed emulator helper does not install qemu/libvirt host packages unless
HOOT_MOBILE_INSTALL_EMULATOR_DEPS=1 is set.

## Release Checklist

Before handing off an Android build, run:

```bash
npm run verify:release
npm run build:android
./build_scripts/android-smoke-launch.sh android/app/build/outputs/apk/release/app-release.apk
```

Use build_scripts/debian-test-hoot-mobile-android.sh instead of the direct
smoke launcher when you want the helper to create and manage the emulator.

If more than one Android device is connected, set ANDROID_SERIAL to the target
device before running the smoke test.
