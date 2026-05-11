#!/usr/bin/env bash
# Android debug APK üretici. JDK 21 + Android cmdline-tools'ı brew ile kurduktan sonra
# (bkz. MOBILE.md §2), bu script tek komutta build edip APK yolunu yazar.
#
# Kullanım:
#   ./scripts/build-android.sh                # debug APK
#   RELEASE=1 ./scripts/build-android.sh      # unsigned release APK
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "JDK 21 not found at $JAVA_HOME"
  echo "Install: brew install openjdk@21"
  exit 1
fi

if [[ ! -d "$ANDROID_HOME/cmdline-tools" ]]; then
  echo "Android cmdline-tools not found at $ANDROID_HOME"
  echo "Install: brew install --cask android-commandlinetools"
  exit 1
fi

echo "→ Building web bundle..."
npm run build

echo "→ Syncing to native projects..."
npx cap sync android

echo "→ Writing local.properties..."
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "→ Running gradle build..."
TASK="assembleDebug"
[[ "${RELEASE:-0}" == "1" ]] && TASK="assembleRelease"

cd android
./gradlew --no-daemon "$TASK"

APK_PATH=$(find app/build/outputs/apk -name "*.apk" -print -quit)
echo
echo "✅ APK: $ROOT/android/$APK_PATH"
ls -lh "$APK_PATH"
