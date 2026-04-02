import type { Metadata, Viewport } from 'next'
import './globals.css'

import ReduxProvider from './components/providers/ReduxProvider'
import { DeviceProvider } from './contexts/DeviceContext'

import NotificationProvider from './components/common/GlobalNotification'
import ErrorToast from './components/ui/ErrorToast'
import CenterLeftMessages from './components/ui/CenterLeftMessages'
import I18nProvider from './components/providers/I18nProvider'

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
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />

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
        <script src="/scripts/dat.gui.min.js"></script>
        <script src="/scripts/Assets.js"></script>
        <script src="/scripts/recast.js"></script>
        <script src="/scripts/ammo.js"></script>
        <script src="/scripts/HavokPhysics_umd.js"></script>
        <script src="/scripts/cannon.js"></script>
        <script src="/scripts/Oimo.js"></script>
        <script src="/scripts/earcut.min.js"></script>
        <script src="/scripts/babylon.js"></script>
        <script src="/scripts/babylonjs.materials.min.js"></script>
        <script src="/scripts/babylonjs.proceduralTextures.min.js"></script>
        <script src="/scripts/babylonjs.postProcess.min.js"></script>
        <script src="/scripts/babylonjs.loaders.js"></script>
        <script src="/scripts/babylonjs.serializers.min.js"></script>
        <script src="/scripts/babylon.gui.min.js"></script>
        <script src="/scripts/babylon.inspector.bundle.js"></script>
        <script src="/env.js" />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning={true}
        style={{
          backgroundColor: '#000000 !important',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <ReduxProvider>
          <I18nProvider>
            <NotificationProvider>
              <DeviceProvider>
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
