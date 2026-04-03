# 内嵌 Web 边界：RN 统一管理，Web 只负责渲染

## 架构原则（与产品一致）

| 层级 | 职责 |
|------|------|
| **React Native** | **统一编排**：当前私服 `serverUrl`、登录态、权限、存储；**按需下载**模型/HDR 等到应用目录；**版本与缓存策略**；通过 Bridge **把「可渲染所需信息」注入 Web**（例如本地 `file://` 根路径、角色列表、每个资源的绝对路径或相对键）。 |
| **WebView 内 Web** | **只负责渲染**：同一套 Babylon / UI 逻辑，**不**自行决定「从哪台服拉哪些模型」；从 Bridge / 注入状态读取路径后 **SceneLoader 加载**。 |

**不是**「Web 自己管 CDN、自己 fetch 大资源」；**也不是**「内嵌 Web 与浏览器里打开的整站同一套部署」——浏览器里仍可照常访问线上 Next；APK 里主页只能是 **`file:///android_asset/web/index.html`**，但 **3D 二进制可以不在 APK 里**，而在 **RN 下载后的本地路径**。

## 瘦包（推荐产品形态）

- **APK 内含**：静态导出壳（HTML/JS/CSS、`public/scripts` 等**运行所需脚本**），**不含**各私服专有 GLB（或仅含极小占位资源，按你们策略定）。
- **连上私服之后**：由 **服务端接口** 告知当前环境有哪些模型、下载 URL、版本号；**RN 下载** → 落盘 → **再通知 Web** 刷新可用列表与路径。
- **开发调试**：本地仍可在 `public/characters/` 等放模型，方便浏览器与部分 WebView 联调；**生产瘦包**不要求构建前填满 `public/` 大文件。

## 与「页面从哪加载」的关系

| 内容 | 来源 |
|------|------|
| UI 壳、JS 包、小体积静态资源 | `next export` → `android/android/app/src/main/assets/web/`（脚本：`scripts/build-android-web.sh`） |
| 角色 GLB、大地 HDR、大地 GLB 等 | **默认由 RN 按服配置下载并缓存**，通过 Bridge 提供 **本机可读 URL**（如 `file://…`）给 Babylon |

**与后端**：API / WebSocket / 编排器仍走用户配置的 **`serverUrl`**；**「页面壳从 APK 读」** 与 **「模型从哪下载」** 分开。

## 实现落点（当前代码）

- **RN**：`prepareNativeAssetManifest()`（`android/src/services/nativeAssets.ts`）在启动时从 **`android_asset/web/...`** 用 `react-native-fs` 的 `copyFileAssets` 复制到 **`DocumentDirectoryPath/dlp3d/...`**，生成 **`file://` 清单**；`DLP3DWebView` 通过 **`injectedJavaScriptBeforeContentLoaded`** 写入 `window.__DLP3D_NATIVE_ASSETS__`，并开启 **`allowFileAccessFromFileURLs`** 供 WebView 加载本地 GLB/HDR。
- **Web**：`app/utils/nativeAssets.ts` 提供 `getCharacterModelUrl` / `getGroundRootUrl` / `resolveHdriUrl`；**有 manifest 时**仅用 RN 下发的路径；**浏览器**仍用当前页 `origin` 或 `file:` 页目录 + `/characters/` 等（无 manifest）。
- **Bridge**：`NativeToWebViewEvent` 含 **`assets:manifest`**，可在后续「私服下发新资源」时 `injectJavaScript` 更新 `window.__DLP3D_NATIVE_ASSETS__`（`injectedJS` 已处理）。

## 离线构建开关

- `NEXT_PUBLIC_OFFLINE_WEBVIEW=1`（由 `build-android-web.sh` 设置）时，避免 Google Fonts、Babylon CDN `Assets.js` 等阻塞首屏；见 `app/layout.tsx`、`app/utils/packagedWebview.ts`。

## 构建脚本

- `./scripts/build-android-web.sh`：导出 Next → 复制到 `android/android/app/src/main/assets/web/`。
- 若需在 CI 验证「演示用胖包」已包含 `public/` 下全部 3D 文件，设置环境变量 **`DLP_CHECK_PACKAGED_3D_ASSETS=1`**，脚本会对缺失的角色/地面/HDR 打印告警（默认 **不** 检查，与瘦包一致）。

## 参考文件名（与服务/旧站对齐时）

当前 Web 代码里仍有默认路径（如 `BabylonViewer` 的 `/characters/*.glb`、`scene.ts` 的 HDR 名）。RN 下发 manifest 时，**键名与文件名**需与这些逻辑或新抽象对齐；详见各文件内常量。开发用清单仍可参考仓库内 `public/*/README.txt`。
