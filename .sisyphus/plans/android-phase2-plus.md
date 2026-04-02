# DLP3D Android — Phase 2+ Implementation Plan

## Architecture Correction

**CRITICAL**: The app does NOT load the remote server's web UI in a WebView. Instead:
- Web frontend code (Next.js bundle) is **packaged locally** inside the APK
- WebView renders from local assets (`file:///android_asset/`)
- Remote server provides only **API endpoints** and **static 3D model assets**
- The RN native shell handles auth, settings, navigation natively
- WebView is used solely as a Babylon.js rendering engine with local HTML/JS/CSS

This means:
1. We need to bundle the Next.js static export into `android/app/src/main/assets/`
2. The WebView loads from local files, not `https://server-url`
3. API calls go to the remote server (`{serverUrl}/api/v1/...`)
4. WebSocket connections go to the remote server
5. 3D model/texture assets can be fetched from remote and cached locally

---

## Phase 2: Local Web Bundle + WebView Integration

**Goal**: Package the Next.js web app as static files inside the APK, load them in WebView, and route API/WebSocket calls to the remote server.

### 2.1 Next.js Static Export
- [ ] Configure `next.config.js` for static export (`output: 'export'`)
- [ ] Run `next build && next export` to generate static HTML/JS/CSS
- [ ] Copy exported files to `android/app/src/main/assets/web/`
- [ ] Verify the static export works: open `index.html` in browser
- [ ] Handle dynamic routes (character pages, etc.) — may need rewrite rules

### 2.2 WebView Local Loading
- [ ] Change `HomeScreen.tsx` WebView `source` from `{ uri: serverUrl }` to `{ uri: 'file:///android_asset/web/index.html' }`
- [ ] Allow WebView to load local files: `allowFileAccess={true}`, `allowFileAccessFromFileURLs={true}`
- [ ] Inject `window.__DLP3D_CONFIG__` with `{ serverUrl, userId, language, theme }` via `injectedJavaScript`
- [ ] Verify Babylon.js renders correctly from local files in WebView

### 2.3 API Proxy / Base URL Injection
- [ ] In the web app's `request/ky.ts`, detect `window.__DLP3D_CONFIG__` to override `prefixUrl`
- [ ] When running inside RN WebView, all API calls should use `serverUrl` from the config
- [ ] WebSocket connections should use `serverUrl` (replace `127.0.0.1` with actual server)
- [ ] Test: login → fetch character list → verify data comes from remote API

### 2.4 Bridge Refinement
- [ ] Implement bidirectional bridge events (Native ↔ WebView)
- [ ] Native → WebView: auth token, settings changes, theme changes
- [ ] WebView → Native: navigation requests, loading state, error reports
- [ ] Android back button: intercept in WebView for in-page navigation

### 2.5 WebView Lifecycle
- [ ] Handle WebGL context loss/restoration
- [ ] Memory management: pause WebView when app is backgrounded
- [ ] WebView preloading on splash screen
- [ ] Loading progress indicator tied to actual page load

**Estimated time**: 1-2 weeks

---

## Phase 3: Web App Adaptation for Mobile WebView

**Goal**: Make the existing Next.js web app aware it's running inside an RN WebView and adapt accordingly.

### 3.1 WebView Mode Detection
- [ ] Add `app/utils/nativeBridge.ts` — detects `window.__DLP3D_NATIVE__` flag
- [ ] When in native mode: hide web navigation bar, sidebar, footer
- [ ] When in native mode: disable web-based auth (native handles it)
- [ ] When in native mode: use native bridge for navigation instead of `router.push()`

### 3.2 Responsive Layout for Mobile
- [ ] Audit existing CSS for mobile viewport (WebView is phone-sized)
- [ ] Adjust Babylon.js canvas to fill WebView completely
- [ ] Optimize touch targets for finger interaction
- [ ] Handle keyboard appearance (WebView resize on soft keyboard)

### 3.3 Conditional UI Hiding
- [ ] Hide top navigation bar when `__DLP3D_NATIVE__` is true
- [ ] Hide sidebar / hamburger menu
- [ ] Hide login/register form (auth handled by native)
- [ ] Keep only the 3D canvas + chat UI visible in WebView

**Estimated time**: 3-5 days

---

## Phase 4: Complete Auth System

**Goal**: Fully functional authentication with token management, auto-login, and WebView cookie sync.

### 4.1 Token Management
- [ ] Store auth token (user_id) in AsyncStorage via redux-persist
- [ ] Auto-login on app launch: check persisted auth state, skip login if valid
- [ ] Token expiry detection: if API returns auth error, force re-login
- [ ] Logout: clear AsyncStorage, reset Redux, notify WebView via bridge

### 4.2 WebView Cookie/Auth Sync
- [ ] After native login, inject auth state into WebView via bridge
- [ ] WebView sets `localStorage.dlp3d_auth_state` from injected data
- [ ] WebView reads `__DLP3D_CONFIG__.userId` for API calls
- [ ] Sync cookies between native and WebView for API authentication

### 4.3 Registration Flow
- [ ] Email verification code input screen (native TextInput)
- [ ] Resend verification code button
- [ ] Registration success → auto-switch to login tab
- [ ] Error handling for all registration edge cases

**Estimated time**: 1 week

---

## Phase 5: Chat & Character Management

**Goal**: Native UI for browsing and managing conversations and characters.

### 5.1 Character List
- [ ] Fetch character list from `{serverUrl}/api/v1/list_characters/{userId}`
- [ ] Display as native card grid with avatar, name, last message preview
- [ ] Pull-to-refresh
- [ ] Empty state placeholder

### 5.2 Character Configuration
- [ ] Fetch character config from `{serverUrl}/api/v1/get_character_config/{userId}/{characterId}`
- [ ] Native screen for viewing/editing character settings
- [ ] Update prompt, scene, TTS, ASR via API calls
- [ ] Changes synced to WebView via bridge

### 5.3 Chat Session Management
- [ ] Create new chat: select character → open WebView with character loaded
- [ ] Resume existing chat: select from list → open WebView with session restored
- [ ] Delete chat with confirmation dialog
- [ ] Chat state synced between native list and WebView

**Estimated time**: 1 week

---

## Phase 6: Settings & Configuration

**Goal**: Full native settings panels that sync with the web app.

### 6.1 Server Configuration
- [ ] Server URL editing with validation
- [ ] Connection test button (ping server)
- [ ] Server URL history / saved servers

### 6.2 LLM Configuration
- [ ] Fetch available LLM providers from API
- [ ] Provider selection dropdown
- [ ] Model override input
- [ ] API key configuration (secure storage)

### 6.3 TTS/ASR Configuration
- [ ] TTS provider and voice selection
- [ ] Voice speed control
- [ ] ASR provider selection
- [ ] Test TTS/ASR buttons

### 6.4 Appearance
- [ ] Theme toggle (dark/light) — syncs to WebView
- [ ] Language switcher (EN/ZH)
- [ ] Font size adjustment

### 6.5 Account Management
- [ ] Saved accounts list with server+email display
- [ ] Quick account switching
- [ ] Remove saved account
- [ ] Change password flow

**Estimated time**: 1 week

---

## Phase 7: Native UX Polish

**Goal**: Make the app feel like a first-class native Android app.

### 7.1 Splash Screen
- [ ] Native splash screen with DLP3D logo
- [ ] Smooth transition to auth or main screen
- [ ] Loading state while AsyncStorage initializes

### 7.2 Permissions
- [ ] Microphone permission request for voice input
- [ ] Storage permission for downloads
- [ ] Permission rationale dialogs (why we need each)

### 7.3 Notifications
- [ ] Push notification setup (Firebase Cloud Messaging)
- [ ] Notification channels for different message types
- [ ] Notification tap → open relevant chat

### 7.4 Gestures & Navigation
- [ ] Android back button: proper navigation stack
- [ ] Swipe gestures in WebView (if needed)
- [ ] Bottom sheet for in-chat options
- [ ] Share intent handling (share text to DLP3D chat)

### 7.5 Performance
- [ ] WebView preloading on app start
- [ ] Image caching (Glide/Coil for avatars)
- [ ] FlatList optimization for chat list
- [ ] Memory monitoring and cleanup

**Estimated time**: 1-2 weeks

---

## Phase 8: Testing & Release

**Goal**: Production-ready app.

### 8.1 Testing
- [ ] Multi-device testing (Android 7-15, various screen sizes)
- [ ] WebGL performance benchmark (target 30fps on mid-range devices)
- [ ] Memory leak testing (long chat sessions)
- [ ] Network resilience (offline, slow, intermittent)
- [ ] Auth flow edge cases (expired token, wrong password, etc.)

### 8.2 Build & Signing
- [ ] Release build configuration (ProGuard/R8 minification)
- [ ] Signing key generation and secure storage
- [ ] App bundle (AAB) generation for Play Store
- [ ] APK size optimization (remove unused architectures)

### 8.3 Store Preparation
- [ ] App icon and adaptive icon
- [ ] Feature graphic and screenshots
- [ ] Store listing (EN + ZH)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire

**Estimated time**: 1-2 weeks

---

## Total Estimated Time

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 2: Local Web + WebView | 1-2 weeks | 1-2 weeks |
| Phase 3: Web Adaptation | 3-5 days | ~3 weeks |
| Phase 4: Auth System | 1 week | ~4 weeks |
| Phase 5: Chat Management | 1 week | ~5 weeks |
| Phase 6: Settings | 1 week | ~6 weeks |
| Phase 7: UX Polish | 1-2 weeks | ~8 weeks |
| Phase 8: Testing & Release | 1-2 weeks | ~10 weeks |

**Total: ~10 weeks (2.5 months)**

---

## Key Technical Decisions

1. **Static export, not SSR**: Next.js static export (`output: 'export'`) because we can't run a Node server inside the APK. All pages become static HTML.

2. **WebView as rendering engine**: WebView is NOT a browser — it's a Babylon.js canvas with chat UI. Native handles everything else.

3. **API calls from WebView**: The WebView JavaScript makes API calls directly to the remote server using the injected `serverUrl`. No proxying through native.

4. **Asset strategy**: Small assets (textures, config) bundled in APK. Large assets (3D models, animations) fetched from remote server and cached locally.

5. **Auth flow**: Native handles login/register → persists token → injects into WebView. WebView never shows its own login form.

---

## Open Questions (need user input)

1. **Next.js static export feasibility**: Does the current Next.js app support `output: 'export'`? Some features (API routes, ISR, SSR) won't work. Need to audit.

2. **Asset hosting**: Where are 3D models hosted? Same server as API? CDN? Need to know for asset loading strategy.

3. **WebSocket endpoint**: What's the WebSocket URL for real-time streaming? Is it `{serverUrl}/ws/...` or a different host/port?

4. **Min Android version**: Currently targeting API 24 (Android 7.0). Is this acceptable, or do we need to support older devices?

5. **Distribution**: Google Play Store? Direct APK distribution? Both?
