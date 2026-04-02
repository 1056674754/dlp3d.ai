// DLP3D environment configuration
// This file provides runtime environment variables for both web and WebView contexts.
// When running inside a WebView, these values are overridden by the native app via injectedJS.
window.__DLP3D_ENV__ = window.__DLP3D_ENV__ || {
  NEXT_PUBLIC_ORCHESTRATOR_HOST: "127.0.0.1",
  NEXT_PUBLIC_ORCHESTRATOR_PORT: "18002",
  NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX: "/api/v4",
  NEXT_PUBLIC_ORCHESTRATOR_TIMEOUT: "10",
  NEXT_PUBLIC_BACKEND_HOST: "127.0.0.1",
  NEXT_PUBLIC_BACKEND_PORT: "18001",
  NEXT_PUBLIC_BACKEND_PATH_PREFIX: "/api/v1",
  NEXT_PUBLIC_MOTION_FILE_TIMEOUT: "60",
  NEXT_PUBLIC_MAX_FRONT_EXTENSION_DURATION: "1.0",
  NEXT_PUBLIC_MAX_REAR_EXTENSION_DURATION: "10.0",
  NEXT_PUBLIC_LANGUAGE: "zh",
};
