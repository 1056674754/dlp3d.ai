#!/usr/bin/env bash
# 构建并安装 Release APK（JS 打入包内，脱离 Metro 也能独立运行）。
# 用法：在项目根目录执行 ./scripts/android-run-release.sh
#
# 先执行 build-android-web.sh 确保内嵌 Web 是最新的，再用 --mode release 构建 APK。
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

# Release 包必须包含最新内嵌 Web
echo "=== Phase 1: 构建内嵌 Web ==="
"$ROOT/scripts/build-android-web.sh"

echo ""
echo "=== Phase 2: 构建 & 安装 Release APK ==="
# 若工程曾从其他路径构建，Gradle 会缓存错误的 autolinking（node_modules 路径不对 → No variants）
rm -rf "$ROOT/android/android/build/generated/autolinking"
cd "$ROOT/android"
# Release 使用 APK 内嵌 bundle，不启动 Metro；避免 8081 占用时卡住交互
exec npx react-native run-android --mode release --no-packager "$@"
