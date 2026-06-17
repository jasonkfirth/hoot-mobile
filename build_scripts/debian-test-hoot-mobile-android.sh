#!/usr/bin/env bash

# Project: Hoot Mobile
# -------------------
#
# File: debian-test-hoot-mobile-android.sh
#
# Purpose:
#
#     Automates the setup of an Android emulator and the installation
#     of a built APK for testing purposes on Debian-based systems.
#
# Responsibilities:
#
#     • Verify the existence of a built APK
#     • Install emulator dependencies (KVM, system images)
#     • Create and start a Virtual Device (AVD)
#     • Install the APK onto the running emulator via ADB
#     • Launch the application for visual verification
#
# This file intentionally does not contain:
#
#     • APK building logic (see debian-build-hoot-mobile-android.sh)
#     • Automated UI test execution

# -------------------------------------------------------------------------
# Fail on errors and surface failures in pipelines
# -------------------------------------------------------------------------
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

log() {
  printf "[hoot-mobile] %s\n" "$*"
}

if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
  ANDROID_HOME_DIR="$ANDROID_SDK_ROOT"
elif [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
  ANDROID_HOME_DIR="$ANDROID_HOME"
elif [ -d "$HOME/Android/Sdk" ]; then
  ANDROID_HOME_DIR="$HOME/Android/Sdk"
else
  ANDROID_HOME_DIR="$HOME/android-sdk"
fi

if [ ! -d "$ANDROID_HOME_DIR" ]; then
  log "Android SDK not found. Expected one of:"
  log "  - ANDROID_SDK_ROOT"
  log "  - ANDROID_HOME"
  log "  - ~/Android/Sdk"
  log "  - ~/android-sdk"
  log "Run the build script first, or set ANDROID_HOME/ANDROID_SDK_ROOT."
  exit 1
fi

AVD_NAME="HootTest"
AVD_IMAGE="system-images;android-34;google_apis;x86_64"
EMULATOR_PACKAGES="qemu-system-x86 libvirt-daemon-system libvirt-clients bridge-utils"
DEFAULT_APK_PATHS=(
  "android/app/build/outputs/apk/release/app-release-unsigned.apk"
  "android/app/build/outputs/apk/release/app-release.apk"
)

command_exists() {
  command -v "$1" &>/dev/null
}

run_root_cmd() {
  if command_exists sudo; then
    if sudo -n true &>/dev/null; then
      sudo "$@"
      return
    fi
  fi

  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  log "Skipping root command: $*"
  log "If you're running without sudo access, install these packages manually first: $EMULATOR_PACKAGES"
}

resolve_sdk_tools() {
  export ANDROID_HOME="$ANDROID_HOME_DIR"
  export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

  ADB="$ANDROID_HOME/platform-tools/adb"
  SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"

  if [ ! -x "$SDKMANAGER" ] && [ -x "$ANDROID_HOME/cmdline-tools/bin/sdkmanager" ]; then
    SDKMANAGER="$ANDROID_HOME/cmdline-tools/bin/sdkmanager"
  fi

  if [ ! -x "$AVDMANAGER" ] && [ -x "$ANDROID_HOME/cmdline-tools/bin/avdmanager" ]; then
    AVDMANAGER="$ANDROID_HOME/cmdline-tools/bin/avdmanager"
  fi

  EMULATOR_BIN="$ANDROID_HOME/emulator/emulator"
}

ensure_emulator_tooling() {
  if [ -x "$EMULATOR_BIN" ]; then
    return
  fi

  if [ -z "${SDKMANAGER:-}" ] || [ ! -x "$SDKMANAGER" ]; then
    return
  fi

  log "Emulator binary not found; installing Android Emulator package via SDK manager."
  yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
  if "$SDKMANAGER" "emulator" >/dev/null 2>&1; then
    export PATH="$PATH:$ANDROID_HOME/emulator"
    if [ ! -x "$EMULATOR_BIN" ]; then
      log "Emulator package installed but binary still missing."
    fi
  else
    log "Failed to install emulator package via SDK manager."
  fi
}

ensure_avd_image() {
  if [ -z "${SDKMANAGER:-}" ] || [ ! -x "$SDKMANAGER" ]; then
    return
  fi

  if "$SDKMANAGER" --list_installed 2>/dev/null | grep -F -q "$AVD_IMAGE"; then
    return
  fi

  log "System image $AVD_IMAGE not installed. Installing now."
  "$SDKMANAGER" "$AVD_IMAGE"
}

EMULATOR_PID=""

cleanup_emulator() {
  if [ -z "$EMULATOR_PID" ]; then
    return
  fi

  if [ "${HOOT_MOBILE_KEEP_EMULATOR:-0}" = "1" ]; then
    log "Leaving emulator running for inspection (HOOT_MOBILE_KEEP_EMULATOR=1)."
    return
  fi

  log "Stopping emulator (PID $EMULATOR_PID)."
  kill "$EMULATOR_PID" >/dev/null 2>&1 || true
}

trap cleanup_emulator EXIT

APK_PATH="${1:-}"

resolve_sdk_tools

if [ -z "$APK_PATH" ]; then
  for candidate in "${DEFAULT_APK_PATHS[@]}"; do
    if [ -f "$PROJECT_ROOT/$candidate" ]; then
      APK_PATH="$PROJECT_ROOT/$candidate"
      break
    fi
  done
fi

if [ -z "$APK_PATH" ] || [ ! -f "$APK_PATH" ]; then
  APK_PATH=$(
    find "$PROJECT_ROOT/android/app/build/outputs/apk" -type f -name '*.apk' 2>/dev/null |
      sort |
      tail -n 1 || true
  )
fi

if [ -z "$APK_PATH" ] || [ ! -f "$APK_PATH" ]; then
  log "Error: APK not found. Run the build script first."
  exit 1
fi

cd "$PROJECT_ROOT"

if command_exists apt-get; then
  log "Installing emulator dependencies..."
  run_root_cmd apt-get update
  run_root_cmd apt-get install -y $EMULATOR_PACKAGES
fi

if [ ! -x "$SDKMANAGER" ] || [ ! -x "$AVDMANAGER" ] || [ ! -x "$ADB" ]; then
  log "Error: Android command-line tools not installed or not available in $ANDROID_HOME_DIR."
  log "Run the build script first to install cmdline-tools and platform-tools."
  exit 1
fi

ensure_emulator_tooling
ensure_avd_image
resolve_sdk_tools

if [ ! -x "$EMULATOR_BIN" ]; then
  log "Error: emulator binary not found. Install Android Emulator via SDK manager or apt package."
  log "For a manual install: $SDKMANAGER --install emulator"
  exit 1
fi

log "Preparing Android system image..."
"$SDKMANAGER" "$AVD_IMAGE"

if [ ! -d "$HOME/.android/avd/$AVD_NAME.avd" ]; then
  log "Creating Virtual Device ($AVD_NAME)..."
  echo "no" | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$AVD_IMAGE" --force
fi

log "Starting emulator..."
if [ ! -x "$EMULATOR_BIN" ]; then
  log "Error: Emulator binary not found at $EMULATOR_BIN."
  exit 1
fi

"$EMULATOR_BIN" -avd "$AVD_NAME" -no-audio -no-window -no-snapshot -gpu off > /tmp/hoot-mobile-emulator.log 2>&1 &
EMULATOR_PID=$!

log "Waiting for emulator to boot..."
"$ADB" wait-for-device

BOOT_COMPLETED=""
for _ in $(seq 1 75); do
  BOOT_COMPLETED=$("$ADB" shell getprop sys.boot_completed | tr -d '\r')
  if [ "$BOOT_COMPLETED" = "1" ]; then
    break
  fi
  sleep 2
done

if [ "$BOOT_COMPLETED" != "1" ]; then
  log "Error: emulator failed to report boot completion."
  exit 1
fi

log "Installing APK: $APK_PATH"
"$ADB" install -r "$APK_PATH"

log "Launching Hoot Mobile..."
"$ADB" shell monkey -p org.brokenlamp.hoot -c android.intent.category.LAUNCHER 1

log "Test setup complete. Emulator running with PID $EMULATOR_PID."

# end of debian-test-hoot-mobile-android.sh
