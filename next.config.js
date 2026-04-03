/** @type {import('next').NextConfig} */

const offlineWebview = process.env.NEXT_PUBLIC_OFFLINE_WEBVIEW === '1'

const nextConfig = {
  reactStrictMode: false,
  output: 'export',
  assetPrefix: offlineWebview ? './' : undefined,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
