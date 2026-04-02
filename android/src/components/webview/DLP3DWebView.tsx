import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useTheme, Button } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { WebViewToNativeEvent } from '@/bridge/types';
import { setIsWebViewReady } from '@/store/appSlice';
import { createInjectedJavaScript } from '@/bridge/injectedJS';
import { bridge } from '@/bridge/WebViewBridge';

const LOCAL_WEB_BASE =
  Platform.OS === 'android'
    ? 'file:///android_asset/web'
    : 'file:///Users/song/dev_ai/dlp3d.ai/public';

export interface DLP3DWebViewProps {
  serverUrl: string;
  userInfo?: { username: string; email: string; id: string };
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  onReady?: () => void;
  onError?: (message: string) => void;
  onLoadingChange?: (
    isLoading: boolean,
    progress?: number,
    text?: string,
  ) => void;
}

export function DLP3DWebView({
  serverUrl,
  authToken,
  language,
  theme: appTheme,
  onReady,
  onError,
  onLoadingChange,
}: DLP3DWebViewProps) {
  const paperTheme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [error, setError] = useState<string | null>(null);
  const canGoBackRef = useRef(false);

  const configuredServerUrl = useSelector(
    (state: RootState) => state.app.serverUrl,
  );

  const webSource = useMemo(() => {
    if (Platform.OS === 'android') {
      return { uri: `${LOCAL_WEB_BASE}/index.html` };
    }
    return { uri: serverUrl };
  }, [serverUrl]);

  const envOverrideJS = useMemo(() => {
    const orchestratorHost = configuredServerUrl.replace(/^https?:\/\//, '').split(':')[0] || '127.0.0.1';
    const orchestratorPort = configuredServerUrl.replace(/^https?:\/\//, '').split(':').pop()?.match(/\d+/)?.[0] || '18002';
    const backendHost = serverUrl.replace(/^https?:\/\//, '').split(':')[0] || '127.0.0.1';
    const backendPort = serverUrl.replace(/^https?:\/\//, '').split(':').pop()?.match(/\d+/)?.[0] || '18001';
    return `
      window.__DLP3D_ENV__ = window.__DLP3D_ENV__ || {};
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_HOST = '${orchestratorHost}';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_PORT = '${orchestratorPort}';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX = '/api/v4';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_TIMEOUT = '10';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_HOST = '${backendHost}';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_PORT = '${backendPort}';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_PATH_PREFIX = '/api/v1';
      window.__DLP3D_ENV__.NEXT_PUBLIC_LANGUAGE = '${language}';
    `;
  }, [configuredServerUrl, serverUrl, language]);

  const injectedJavaScript = useMemo(
    () =>
      envOverrideJS + ';\n' +
      createInjectedJavaScript({
        authToken,
        serverUrl,
        language,
        theme: appTheme,
      }),
    [authToken, serverUrl, language, appTheme, envOverrideJS],
  );

  useEffect(() => {
    bridge.setRef(webViewRef.current);
  }, []);

  const handleReload = useCallback(() => {
    setError(null);
    webViewRef.current?.reload();
  }, []);

  useEffect(() => {
    const unsubReady = bridge.on('ready', () => {
      onReady?.();
    });

    const unsubError = bridge.on('error', (payload: unknown) => {
      const { message, code } = payload as { message: string; code?: string };
      if (code === 'WEBGL_LOST') {
        setTimeout(() => {
          webViewRef.current?.reload();
        }, 3000);
        return;
      }
      setError(message);
      onError?.(message);
    });

    const unsubLoading = bridge.on('loading:state', (payload: unknown) => {
      const { isLoading, progress, text } = payload as {
        isLoading: boolean;
        progress?: number;
        text?: string;
      };
      onLoadingChange?.(isLoading, progress, text);
    });

    return () => {
      unsubReady();
      unsubError();
      unsubLoading();
    };
  }, [onReady, onError, onLoadingChange]);

  const handleNavigationStateChange = useCallback(
    (navState: { canGoBack?: boolean }) => {
      canGoBackRef.current = navState.canGoBack ?? false;
    },
    [],
  );

  useEffect(() => {
    const handleBackPress = (): boolean => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => subscription.remove();
  }, []);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      bridge.handleMessage(event.nativeEvent.data);
    },
    [],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      if (request.url.startsWith('native://')) {
        return false;
      }
      return true;
    },
    [],
  );

  const handleError = useCallback(
    (syntheticEvent: { nativeEvent: { description?: string } }) => {
      const description =
        syntheticEvent.nativeEvent.description || 'Unknown error';
      setError(description);
      onError?.(description);
    },
    [onError],
  );

  const renderLoading = useCallback(
    () => (
      <View style={[styles.loadingOverlay, { backgroundColor: paperTheme.colors.background }]}>
        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
      </View>
    ),
    [paperTheme.colors.background, paperTheme.colors.primary],
  );

  if (error) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: paperTheme.colors.background },
        ]}>
        <Text style={[styles.errorTitle, { color: paperTheme.colors.onBackground }]}>
          Something went wrong
        </Text>
        <Text style={[styles.errorMessage, { color: paperTheme.colors.onSurface }]}>
          {error}
        </Text>
        <Button mode="contained" onPress={handleReload} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={webSource}
      injectedJavaScript={injectedJavaScript}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      onNavigationStateChange={handleNavigationStateChange}
      onError={handleError}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      webviewDebuggingEnabled={__DEV__}
      renderLoading={renderLoading}
      startInLoadingState
      style={styles.webview}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  retryButton: {
    paddingHorizontal: 16,
  },
});
