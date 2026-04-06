/** @type {import('next').NextConfig} */
const path = require('path')
const fs = require('fs')

const offlineWebview = process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'

// For offline/Android builds, replace server-only route files with empty stubs
// so that `output: 'export'` doesn't choke on cookies/db/dynamic features.
function collectRouteFiles(dir) {
  const files = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

const nextConfig = {
  reactStrictMode: false,
  output: offlineWebview ? 'export' : 'standalone',
  assetPrefix: offlineWebview ? './' : undefined,
  images: {
    unoptimized: true,
  },
  ...(offlineWebview
    ? {
        webpack: (config) => {
          const appDir = path.resolve(__dirname, 'app')
          const dirsToExclude = [
            path.join(appDir, 'api'),
            path.join(appDir, 'dashboard'),
          ]
          const emptyModule = require.resolve('./app/lib/empty-module.js')
          for (const dir of dirsToExclude) {
            for (const file of collectRouteFiles(dir)) {
              config.resolve.alias[file] = emptyModule
            }
          }
          return config
        },
      }
    : {}),
}

module.exports = nextConfig
