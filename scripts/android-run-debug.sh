#!/usr/bin/env bash
# 用当前磁盘上的 JS 源码安装 Debug APK（会连接 Metro，避免只跑 gradlew 时手机仍用旧 bundle）。
# 用法：在项目根目录执行 ./scripts/android-run-debug.sh
#
# 说明：react-native CLI 默认找 $HOME/Library/Android/sdk/platform-tools/adb。
# 若你的 adb 只在 ~/android-platform-tools 或通过 ~/bin/adb 指向别处，必须先设 ANDROID_HOME
#（本脚本会尝试自动设置）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${ANDROID_HOME:-}" ]] || [[ ! -x "${ANDROID_HOME}/platform-tools/adb" ]]; then
  for cand in "${HOME}/android-platform-tools" "${HOME}/Library/Android/sdk"; do
    if [[ -x "${cand}/platform-tools/adb" ]]; then
      export ANDROID_HOME="${cand}"
      break
    fi
  done
fi

if [[ -n "${ANDROID_HOME:-}" ]] && [[ -d "${ANDROID_HOME}/platform-tools" ]]; then
  export PATH="${ANDROID_HOME}/platform-tools:${PATH}"
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  for cand in \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"; do
    if [[ -x "${cand}/bin/java" ]]; then
      export JAVA_HOME="${cand}"
      break
    fi
  done
fi

if [[ -n "${JAVA_HOME:-}" ]] && [[ -d "${JAVA_HOME}/bin" ]]; then
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "错误: 找不到 adb。请安装 Android platform-tools，或设置 ANDROID_HOME 为包含 platform-tools 的 SDK 根目录。" >&2
  echo "例如: export ANDROID_HOME=\"\$HOME/android-platform-tools\"" >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "错误: 找不到 Java。请安装 JDK，或设置 JAVA_HOME 指向有效的 JDK 根目录。" >&2
  echo "例如: export JAVA_HOME=\"/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home\"" >&2
  exit 1
fi

WEB_INDEX="$ROOT/android/android/app/src/main/assets/web/index.html"
if [[ -z "${SKIP_EMBEDDED_WEB_BUILD:-}" ]] && [[ ! -f "$WEB_INDEX" ]]; then
  echo "未发现 APK 内嵌 Web（缺少 assets/web/index.html）。正在执行 scripts/build-android-web.sh …" >&2
  "$ROOT/scripts/build-android-web.sh"
fi

cd "$ROOT/android"
exec npx react-native run-android "$@"
