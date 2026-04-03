import type { Metadata, Viewport } from 'next'
import './globals.css'

import ReduxProvider from './components/providers/ReduxProvider'
import { DeviceProvider } from './contexts/DeviceContext'

import NotificationProvider from './components/common/GlobalNotification'
import ErrorToast from './components/ui/ErrorToast'
import CenterLeftMessages from './components/ui/CenterLeftMessages'
import I18nProvider from './components/providers/I18nProvider'
import { NativeWebBridge } from './components/native/NativeWebBridge'

/**
 * Application metadata configuration.
 */
export const metadata: Metadata = {
  title: 'Digital Life Project 2',
  description: 'Embodying Autonomous Characters in Living Worlds',
}

/**
 * Viewport configuration for responsive design.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
}

/**
 * Root layout component for the Next.js application.
 *
 * Provides the root HTML structure with necessary providers, fonts, and external scripts.
 * Includes Redux store, internationalization, notifications, and device context providers.
 * Loads Babylon.js and related libraries for 3D rendering capabilities.
 *
 * @param children The child components to render within the layout.
 *
 * @returns The root HTML structure with all providers and scripts configured.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  /**
   * Set when building static export for APK / offline WebView (`scripts/build-android-web.sh`).
   * Skips Google Fonts, Babylon Inspector, and `Assets.js` (CDN mesh index) — packaged
   * RN WebView must not depend on remote URLs for rendering assets.
   */
  const offlineWebview = process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'
  const staticAssetPrefix = offlineWebview ? '.' : ''

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        {offlineWebview && (
          <script
            dangerouslySetInnerHTML={{
              __html: 'window.__DLP3D_EMBEDDED_IN_RN__=true;',
            }}
          />
        )}
        {!offlineWebview && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
              rel="stylesheet"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Rajdhani:wght@300;400;500;600;700&display=swap"
              rel="stylesheet"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap"
              rel="stylesheet"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap"
              rel="stylesheet"
            />
            <link
              href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap"
              rel="stylesheet"
            />
          </>
        )}
        <script src={`${staticAssetPrefix}/scripts/dat.gui.min.js`}></script>
        {!offlineWebview && (
          <script src={`${staticAssetPrefix}/scripts/Assets.js`}></script>
        )}
        <script src={`${staticAssetPrefix}/scripts/recast.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/ammo.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/HavokPhysics_umd.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/cannon.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/Oimo.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/earcut.min.js`}></script>
        <script src={`${staticAssetPrefix}/scripts/babylon.js`}></script>
        <script
          src={`${staticAssetPrefix}/scripts/babylonjs.materials.min.js`}
        ></script>
        <script
          src={`${staticAssetPrefix}/scripts/babylonjs.proceduralTextures.min.js`}
        ></script>
        <script
          src={`${staticAssetPrefix}/scripts/babylonjs.postProcess.min.js`}
        ></script>
        <script src={`${staticAssetPrefix}/scripts/babylonjs.loaders.js`}></script>
        <script
          src={`${staticAssetPrefix}/scripts/babylonjs.serializers.min.js`}
        ></script>
        <script src={`${staticAssetPrefix}/scripts/babylon.gui.min.js`}></script>
        {!offlineWebview && (
          <script
            src={`${staticAssetPrefix}/scripts/babylon.inspector.bundle.js`}
          ></script>
        )}
        <script src={`${staticAssetPrefix}/env.js`} />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning={true}
        style={{
          backgroundColor: '#000000 !important',
          fontFamily: offlineWebview
            ? "system-ui, -apple-system, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"
            : "'Inter', sans-serif",
        }}
      >
        <ReduxProvider>
          <I18nProvider>
            <NotificationProvider>
              <DeviceProvider>
                <NativeWebBridge />
                {children}
                <ErrorToast />
                <CenterLeftMessages />
              </DeviceProvider>
            </NotificationProvider>
          </I18nProvider>
        </ReduxProvider>
      </body>
    </html>
  )
}
