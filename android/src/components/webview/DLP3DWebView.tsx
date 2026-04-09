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
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { pushDebugLog } from '@/store/debugLogStore';
import {
  downloadStarted,
  setNativeAssetRow,
  downloadFinished,
  downloadFailed,
} from '@/store/nativeAssetDownloadSlice';
import { createInjectedJavaScript } from '@/bridge/injectedJS';
import { bridge } from '@/bridge/WebViewBridge';
import {
  prepareNativeAssetManifest,
  type NativeAssetManifest,
  type NativeAssetProgressCallbacks,
} from '@/services/nativeAssets';
import {
  createStartupSpan,
  logStartupEvent,
  recordStartupMetric,
  resetStartupMetrics,
} from '@/utils/startupProfiler';
import { paperButtonFontScalingProps } from '@/theme/fontScaling';

const LOCAL_WEB_BASE =
  Platform.OS === 'android'
    ? 'file:///android_asset/web'
    : 'file:///Users/song/dev_ai/dlp3d.ai/public';

export interface DLP3DWebViewProps {
  serverUrl: string;
  /** 若已登录，可注入给 Web 端；未接 Redux 时可不传 */
  authToken?: string;
  userInfo?: { username: string; email: string; id: string };
  /** RN 登录态：在 document 前写入 `dlp3d_auth_state`，与 Web Authenticator 结构一致 */
  webviewAuth?: {
    isLogin: boolean;
    userInfo: { username: string; email: string; id: string };
  };
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
  webviewAuth,
  language,
  theme: appTheme,
  onReady,
  onError,
  onLoadingChange,
}: DLP3DWebViewProps) {
  const dispatch = useDispatch();
  const paperTheme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const canGoBackRef = useRef(false);
  const [androidAssets, setAndroidAssets] =
    useState<NativeAssetManifest | null>(null);
  const [, setAndroidAssetsLoading] = useState(Platform.OS === 'android');
  /** APK 未打入 assets/web/ 时 file:// 会 ERR_FILE_NOT_FOUND，改加载 Settings 里的站点根（HTTPS） */
  const [remoteEmbedAfterFileError, setRemoteEmbedAfterFileError] =
    useState(false);

  const configuredServerUrl = useSelector(
    (state: RootState) => state.app.serverUrl,
  );
  const characterAssetsBaseUrl = useSelector(
    (state: RootState) => state.app.characterAssetsBaseUrl ?? '',
  );
  const sceneAssetsBaseUrl = useSelector(
    (state: RootState) => state.app.sceneAssetsBaseUrl ?? '',
  );

  const nativeAssetOptions = useMemo(
    () => ({
      apiServerUrl: configuredServerUrl,
      characterAssetsBaseUrl,
      sceneAssetsBaseUrl,
    }),
    [configuredServerUrl, characterAssetsBaseUrl, sceneAssetsBaseUrl],
  );

  const nativeAssetProgress = useMemo<NativeAssetProgressCallbacks>(
    () => ({
      onStart: ({ rows }) => {
        dispatch(downloadStarted({ rows }));
      },
      onRow: ({ rel, status }) => {
        dispatch(setNativeAssetRow({ rel, status }));
      },
    }),
    [dispatch],
  );

  useEffect(() => {
    void resetStartupMetrics();
    logStartupEvent('webview.component-mounted', {
      platform: Platform.OS,
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    let cancelled = false;
    const finishPrepareSpan = createStartupSpan(
      'webview.prepare-native-assets',
    );
    prepareNativeAssetManifest(nativeAssetOptions, nativeAssetProgress)
      .then(({ initialManifest, backgroundSync }) => {
        if (!cancelled) {
          setAndroidAssets(initialManifest);
          setAndroidAssetsLoading(false);
          logStartupEvent('webview.initial-manifest-applied', {
            characterCount: Object.keys(initialManifest.characterByModelIndex)
              .length,
          });
        }
        finishPrepareSpan({
          hasBackgroundSync: !!backgroundSync,
        });
        if (backgroundSync) {
          void backgroundSync
            .then(finalManifest => {
              if (!cancelled) {
                setAndroidAssets(finalManifest);
                dispatch(downloadFinished());
                logStartupEvent('webview.background-manifest-applied', {
                  characterCount: Object.keys(
                    finalManifest.characterByModelIndex,
                  ).length,
                });
              }
            })
            .catch(e => {
              if (!cancelled) {
                dispatch(
                  downloadFailed(e instanceof Error ? e.message : String(e)),
                );
              }
            });
        } else if (!cancelled) {
          dispatch(downloadFinished());
        }
      })
      .catch(e => {
        finishPrepareSpan({
          failed: true,
        });
        if (!cancelled) {
          setAndroidAssetsLoading(false);
          dispatch(downloadFailed(e instanceof Error ? e.message : String(e)));
          setError(
            e instanceof Error
              ? e.message
              : 'Failed to download 3D assets (check network and Settings URLs)',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nativeAssetOptions, nativeAssetProgress, dispatch]);

  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );

  useEffect(() => {
    setSourceOverride(null);
  }, [selectedCharacterId]);

  const webSource = useMemo(() => {
    if (sourceOverride) return { uri: sourceOverride };
    if (Platform.OS === 'android') {
      const params = selectedCharacterId
        ? `?character_id=${encodeURIComponent(selectedCharacterId)}`
        : '';

      if (remoteEmbedAfterFileError) {
        const u = serverUrl.trim().replace(/\/+$/, '');
        return { uri: `${u}/` };
      }
      return { uri: `${LOCAL_WEB_BASE}/babylon.html${params}` };
    }
    return { uri: serverUrl };
  }, [
    serverUrl,
    remoteEmbedAfterFileError,
    sourceOverride,
    selectedCharacterId,
  ]);

  const envOverrideJS = useMemo(() => {
    // Use __SAME_ORIGIN__ sentinel so buildPrefixUrl in ky.ts
    // constructs the full URL from window.location.origin at runtime.
    // For file:// WebView we override the origin via a patched buildPrefixUrl
    // that checks __DLP3D_SERVER_ORIGIN__ first.
    const normalizedServerUrl = serverUrl.trim().replace(/\/+$/, '');
    const normalizedConfiguredUrl = configuredServerUrl
      .trim()
      .replace(/\/+$/, '');
    const normalizedCharacterAssetsBaseUrl = (
      characterAssetsBaseUrl || normalizedServerUrl
    )
      .trim()
      .replace(/\/+$/, '');
    const normalizedSceneAssetsBaseUrl = (
      sceneAssetsBaseUrl || normalizedServerUrl
    )
      .trim()
      .replace(/\/+$/, '');
    return `
      window.__DLP3D_ENV__ = window.__DLP3D_ENV__ || {};
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_HOST = '__SAME_ORIGIN__';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_PORT = '';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_PATH_PREFIX = '/api/v4';
      window.__DLP3D_ENV__.NEXT_PUBLIC_ORCHESTRATOR_TIMEOUT = '10';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_HOST = '__SAME_ORIGIN__';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_PORT = '';
      window.__DLP3D_ENV__.NEXT_PUBLIC_BACKEND_PATH_PREFIX = '/api/v1';
      window.__DLP3D_ENV__.NEXT_PUBLIC_LANGUAGE = '${language}';
      window.__DLP3D_SERVER_ORIGIN__ = '${normalizedServerUrl}';
      window.__DLP3D_ORCHESTRATOR_ORIGIN__ = '${normalizedConfiguredUrl}';
      window.__DLP3D_REMOTE_CHARACTER_ASSET_BASE__ = '${normalizedCharacterAssetsBaseUrl}';
      window.__DLP3D_REMOTE_SCENE_ASSET_BASE__ = '${normalizedSceneAssetsBaseUrl}';
    `;
  }, [
    configuredServerUrl,
    serverUrl,
    language,
    characterAssetsBaseUrl,
    sceneAssetsBaseUrl,
  ]);

  const injectedJavaScript = useMemo(
    () =>
      envOverrideJS +
      ';\n' +
      createInjectedJavaScript({
        authToken,
        serverUrl,
        language,
        theme: appTheme,
      }),
    [authToken, serverUrl, language, appTheme, envOverrideJS],
  );

  const authPreludeForWeb = useMemo(() => {
    if (!webviewAuth?.isLogin || !webviewAuth.userInfo?.id) {
      return '';
    }
    const payload = JSON.stringify({
      isLogin: true,
      userInfo: {
        username: webviewAuth.userInfo.username,
        email: webviewAuth.userInfo.email,
        id: webviewAuth.userInfo.id,
      },
    });
    return `(function(){try{localStorage.setItem('dlp3d_auth_state',${JSON.stringify(
      payload,
    )});}catch(e){}})();`;
  }, [webviewAuth]);

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const prelude = `
      (function() {
        window.__DLP3D_EMBEDDED_IN_RN__ = true;
        var viewportContent =
          'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
        var applyEmbeddedViewport = function() {
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta && document.head) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'viewport');
            document.head.appendChild(meta);
          }
          if (meta) {
            meta.setAttribute('content', viewportContent);
          }
          if (document.documentElement) {
            document.documentElement.style.width = '100%';
            document.documentElement.style.height = '100%';
            document.documentElement.style.overflow = 'hidden';
          }
          if (document.body) {
            document.body.style.width = '100%';
            document.body.style.height = '100%';
            document.body.style.margin = '0';
            document.body.style.overflow = 'hidden';
          }
        };
        applyEmbeddedViewport();
        document.addEventListener('DOMContentLoaded', applyEmbeddedViewport);
      })();
    `;
    const parts = [prelude, envOverrideJS, authPreludeForWeb];
    if (androidAssets) {
      parts.push(
        'window.__DLP3D_NATIVE_ASSETS__=' + JSON.stringify(androidAssets) + ';',
      );
    }
    parts.push('true;');
    return parts.join('\n');
  }, [androidAssets, authPreludeForWeb, envOverrideJS]);

  const setWebViewRef = useCallback((instance: WebView | null) => {
    webViewRef.current = instance;
    bridge.setRef(instance);
  }, []);

  useEffect(() => {
    if (!androidAssets) {
      return;
    }
    logStartupEvent('webview.send-assets-manifest', {
      characterCount: Object.keys(androidAssets.characterByModelIndex).length,
    });
    bridge.send({
      type: 'assets:manifest',
      payload: androidAssets,
    });
  }, [androidAssets]);

  const handleReload = useCallback(() => {
    setError(null);
    setRemoteEmbedAfterFileError(false);
    if (Platform.OS === 'android' && !androidAssets) {
      setAndroidAssetsLoading(true);
      const finishPrepareSpan = createStartupSpan(
        'webview.prepare-native-assets',
      );
      prepareNativeAssetManifest(nativeAssetOptions, nativeAssetProgress)
        .then(({ initialManifest, backgroundSync }) => {
          setAndroidAssets(initialManifest);
          setAndroidAssetsLoading(false);
          finishPrepareSpan({
            hasBackgroundSync: !!backgroundSync,
          });
          if (backgroundSync) {
            void backgroundSync
              .then(finalManifest => {
                setAndroidAssets(finalManifest);
                dispatch(downloadFinished());
              })
              .catch(e => {
                dispatch(
                  downloadFailed(e instanceof Error ? e.message : String(e)),
                );
              });
          } else {
            dispatch(downloadFinished());
          }
        })
        .catch(e => {
          finishPrepareSpan({
            failed: true,
          });
          dispatch(downloadFailed(e instanceof Error ? e.message : String(e)));
          setError(
            e instanceof Error
              ? e.message
              : 'Failed to download 3D assets (check network and Settings URLs)',
          );
        })
        .finally(() => {
          setAndroidAssetsLoading(false);
        });
      return;
    }
    webViewRef.current?.reload();
  }, [androidAssets, nativeAssetOptions, nativeAssetProgress, dispatch]);

  useEffect(() => {
    const unsubReady = bridge.on('ready', () => {
      logStartupEvent('webview.bridge-ready');
      pushDebugLog('bridge', 'WebView bridge ready');
      onReady?.();
    });

    const unsubError = bridge.on('error', (payload: unknown) => {
      const { message, code } = payload as { message: string; code?: string };
      pushDebugLog('error', `[${code || 'ERR'}] ${message?.slice(0, 150)}`);
      if (code === 'WEBGL_LOST') {
        setTimeout(() => {
          webViewRef.current?.reload();
        }, 3000);
        return;
      }
      if (code === 'UNHANDLED_REJECTION' || code === 'JS_ERROR') {
        console.warn(`[WebView ${code}] ${message}`);
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
      const pct = progress != null ? Math.round(progress * 100) + '%' : '';
      pushDebugLog(
        'web',
        `loading ${isLoading ? '⏳' : '✅'} ${pct} ${text || ''}`,
      );
      onLoadingChange?.(isLoading, progress, text);
    });

    const unsubStartupMetric = bridge.on('startup:metric', payload => {
      const p = payload as { stage: string; elapsedMs: number };
      pushDebugLog('perf', `${p.stage} ${Math.round(p.elapsedMs)}ms`);
      recordStartupMetric('web', p);
    });

    const unsubDebugLog = bridge.on('debug:log', payload => {
      const p = payload as { level?: string; message?: string };
      const level = p.level || 'log';
      const message = p.message || '';
      pushDebugLog('web', `[${level}] ${message.slice(0, 240)}`);
      if (level === 'error') {
        console.error(`[WebViewConsole ${level}] ${message}`);
      } else if (level === 'warn') {
        console.warn(`[WebViewConsole ${level}] ${message}`);
      } else {
        console.log(`[WebViewConsole ${level}] ${message}`);
      }
    });

    return () => {
      unsubReady();
      unsubError();
      unsubLoading();
      unsubStartupMetric();
      unsubDebugLog();
    };
  }, [onReady, onError, onLoadingChange]);

  const handleNavigationStateChange = useCallback(
    (navState: { canGoBack?: boolean; url?: string }) => {
      canGoBackRef.current = navState.canGoBack ?? false;
      if (navState.url) {
        pushDebugLog(
          'rn',
          `navigate → ${navState.url.replace(/.*\/web\//, '/')}`,
        );
      }
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
      const raw = event.nativeEvent.data;
      try {
        const parsed = JSON.parse(raw);
        const t = parsed?.type || '?';
        const p = parsed?.payload;
        if (t.startsWith('startup:')) {
          const stage = p?.stage || '';
          const ms =
            p?.elapsedMs != null ? ` ${Math.round(p.elapsedMs)}ms` : '';
          pushDebugLog('perf', `${stage}${ms}`);
        } else if (t === 'loading:state') {
          const pct =
            p?.progress != null ? ` ${Math.round(p.progress * 100)}%` : '';
          const txt = p?.text || '';
          pushDebugLog(
            'web',
            `loading ${p?.isLoading ? 'ON' : 'OFF'}${pct} ${txt}`,
          );
        } else if (t === 'webview:navigate') {
          const navUrl = p?.url;
          if (navUrl) {
            pushDebugLog('nav', `→ ${navUrl}`);
            setSourceOverride(navUrl);
          }
        } else if (t === 'error') {
          pushDebugLog(
            'error',
            `${p?.code || ''} ${p?.message || raw.slice(0, 120)}`,
          );
        } else if (t === 'debug:log') {
          pushDebugLog(
            'web',
            `[${p?.level || 'log'}] ${String(p?.message || '').slice(0, 240)}`,
          );
        } else if (t === 'chat:list:updated') {
          pushDebugLog(
            'bridge',
            `chat:list:updated chats=${p?.chats?.length ?? '?'}`,
          );
        } else {
          pushDebugLog('bridge', `${t} ${JSON.stringify(p).slice(0, 100)}`);
        }
      } catch {
        /* not JSON */
      }
      bridge.handleMessage(raw);
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
      if (
        Platform.OS === 'android' &&
        !remoteEmbedAfterFileError &&
        /ERR_FILE_NOT_FOUND/i.test(description)
      ) {
        setRemoteEmbedAfterFileError(true);
        return;
      }
      setError(description);
      onError?.(description);
    },
    [onError, remoteEmbedAfterFileError],
  );

  const renderLoading = useCallback(
    () => (
      <View
        style={[
          styles.loadingOverlay,
          { backgroundColor: paperTheme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
      </View>
    ),
    [paperTheme.colors.background, paperTheme.colors.primary],
  );

  /** 单一 return + 外层 flex，避免分支提前 return 与布局在 Android 上异常 */
  return (
    <View style={styles.fill}>
      {error ? (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: paperTheme.colors.background },
          ]}
        >
          <Text
            style={[
              styles.errorTitle,
              { color: paperTheme.colors.onBackground },
            ]}
          >
            Something went wrong
          </Text>
          <Text
            style={[
              styles.errorMessage,
              { color: paperTheme.colors.onSurface },
            ]}
          >
            {error}
          </Text>
          <Button
            {...paperButtonFontScalingProps}
            mode="contained"
            onPress={handleReload}
            style={styles.retryButton}
          >
            Retry
          </Button>
        </View>
      ) : (
        <WebView
          key={remoteEmbedAfterFileError ? 'remote-https' : 'file-asset'}
          ref={setWebViewRef}
          source={webSource}
          injectedJavaScriptBeforeContentLoaded={
            injectedJavaScriptBeforeContentLoaded
          }
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          onRenderProcessGone={({ nativeEvent }) => {
            const message = nativeEvent.didCrash
              ? 'WebView render process crashed'
              : 'WebView render process was killed';
            setError(message);
            onError?.(message);
          }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          webviewDebuggingEnabled
          renderLoading={renderLoading}
          startInLoadingState
          androidLayerType="hardware"
          cacheEnabled
          overScrollMode="never"
          scalesPageToFit={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          textZoom={100}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
          setSupportMultipleWindows={false}
          {...(Platform.OS === 'android'
            ? {
                allowFileAccessFromFileURLs: true as const,
                allowUniversalAccessFromFileURLs: true as const,
              }
            : {})}
          style={styles.webview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
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
