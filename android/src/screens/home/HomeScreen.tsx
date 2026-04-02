import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { createInjectedJavaScript } from '@/bridge/injectedJS';
import { bridge } from '@/bridge/WebViewBridge';
import type { RootState } from '@/store';
import type { WebViewToNativeEvent } from '@/bridge/types';

export function HomeScreen() {
  const theme = useTheme();
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const language = useSelector((state: RootState) => state.app.language);
  const appTheme = useSelector((state: RootState) => state.app.theme);
  const isLogin = useSelector((state: RootState) => state.auth.isLogin);
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const authToken = isLogin ? userInfo.id : undefined;

  const injectedJS = useMemo(
    () =>
      createInjectedJavaScript({
        authToken,
        serverUrl,
        language,
        theme: appTheme,
      }),
    [authToken, serverUrl, language, appTheme],
  );

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

  const renderLoading = () => (
    <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      <WebView
        ref={ref => bridge.setRef(ref)}
        source={{ uri: serverUrl }}
        injectedJavaScript={injectedJS}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
});
