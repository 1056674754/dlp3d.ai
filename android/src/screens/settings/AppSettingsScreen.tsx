import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import {
  Text,
  Switch,
  List,
  Divider,
  useTheme,
  Button,
  Portal,
  Dialog,
  TextInput,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import type { NativeAssetDownloadRow } from '@/store/nativeAssetDownloadSlice';
import {
  setLanguage,
  setTheme,
  setServerUrl,
  setCharacterAssetsBaseUrl,
  setSceneAssetsBaseUrl,
  setDebugMode,
} from '@/store/appSlice';
import { setWakeWordKeywords } from '@/store/wakeWordSlice';
import { logout } from '@/store/authSlice';
import { bridge } from '@/bridge/WebViewBridge';
import { useTranslation } from 'react-i18next';
import { logoutDashboardSession } from '@/services/api';
import { useWakeWord } from '@/hooks/useWakeWord';
import {
  paperButtonFontScalingProps,
  paperListItemFontScalingProps,
  paperSubheaderFontScalingProps,
  paperTextInputFontScalingProps,
} from '@/theme/fontScaling';

type TabParamList = {
  Home: undefined;
  ChatList: undefined;
  Settings: undefined;
};

type SettingsTabNav = BottomTabNavigationProp<TabParamList, 'Settings'>;

function nativeAssetStatusDescription(
  row: NativeAssetDownloadRow,
  t: (key: string) => string,
): string {
  switch (row.status) {
    case 'pending':
      return t('settings.nativeAssetsStatus.pending');
    case 'running':
      return t('settings.nativeAssetsStatus.running');
    case 'ok':
      return t('settings.nativeAssetsStatus.ok');
    case 'skipped':
      return t('settings.nativeAssetsStatus.skipped');
    case 'error':
      return t('settings.nativeAssetsStatus.error');
    default:
      return row.status;
  }
}

function nativeAssetStatusIcon(
  status: NativeAssetDownloadRow['status'],
): string {
  switch (status) {
    case 'ok':
      return 'check-circle';
    case 'skipped':
      return 'close-circle-outline';
    case 'running':
      return 'progress-download';
    case 'error':
      return 'alert-circle';
    default:
      return 'circle-outline';
  }
}

export function AppSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation<SettingsTabNav>();
  const language = useSelector((state: RootState) => state.app.language);
  const appTheme = useSelector((state: RootState) => state.app.theme);
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const characterAssetsBaseUrl = useSelector(
    (state: RootState) => state.app.characterAssetsBaseUrl ?? '',
  );
  const sceneAssetsBaseUrl = useSelector(
    (state: RootState) => state.app.sceneAssetsBaseUrl ?? '',
  );
  const nativeAssetDl = useSelector(
    (state: RootState) => state.nativeAssetDownload,
  );
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const debugMode = useSelector((state: RootState) => state.app.debugMode);

  const {
    isEnabled: wakeWordEnabled,
    isListening: wakeWordListening,
    modelLoaded: wakeWordModelLoaded,
    error: wakeWordError,
    keywords: wakeWordKeywords,
    toggleWakeWord,
  } = useWakeWord();

  const [editingWakeWords, setEditingWakeWords] = useState(wakeWordKeywords.join('\n'));
  const [showWakeWordDialog, setShowWakeWordDialog] = useState(false);

  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [editingUrl, setEditingUrl] = useState(serverUrl);
  const [showCharacterAssetsDialog, setShowCharacterAssetsDialog] =
    useState(false);
  const [editingCharacterAssetsUrl, setEditingCharacterAssetsUrl] =
    useState('');
  const [showSceneAssetsDialog, setShowSceneAssetsDialog] = useState(false);
  const [editingSceneAssetsUrl, setEditingSceneAssetsUrl] = useState('');

  const handleSaveUrl = () => {
    const trimmed = editingUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setServerUrl(trimmed));
      setShowUrlDialog(false);
    } else {
      Alert.alert(
        t('settings.alerts.invalidUrlTitle'),
        t('settings.alerts.invalidServerUrl'),
      );
    }
  };

  const handleSaveCharacterAssetsUrl = () => {
    const trimmed = editingCharacterAssetsUrl.trim().replace(/\/+$/, '');
    if (trimmed.length === 0) {
      dispatch(setCharacterAssetsBaseUrl(''));
      setShowCharacterAssetsDialog(false);
      return;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setCharacterAssetsBaseUrl(trimmed));
      setShowCharacterAssetsDialog(false);
    } else {
      Alert.alert(
        t('settings.alerts.invalidUrlTitle'),
        t('settings.alerts.invalidAssetUrl'),
      );
    }
  };

  const handleSaveSceneAssetsUrl = () => {
    const trimmed = editingSceneAssetsUrl.trim().replace(/\/+$/, '');
    if (trimmed.length === 0) {
      dispatch(setSceneAssetsBaseUrl(''));
      setShowSceneAssetsDialog(false);
      return;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setSceneAssetsBaseUrl(trimmed));
      setShowSceneAssetsDialog(false);
    } else {
      Alert.alert(
        t('settings.alerts.invalidUrlTitle'),
        t('settings.alerts.invalidAssetUrl'),
      );
    }
  };

  const compactListItemProps = {
    ...paperListItemFontScalingProps,
    style: styles.listItem,
    contentStyle: styles.listItemContent,
    titleStyle: [styles.listItemTitle, { color: theme.colors.onSurface }],
    descriptionStyle: [
      styles.listItemDescription,
      { color: theme.colors.onSurface + '70' },
    ],
  } as const;

  const compactSubheaderProps = {
    ...paperSubheaderFontScalingProps,
    style: [styles.sectionSubheader, { color: theme.colors.primary }],
  } as const;

  const denseDialogInputProps = {
    ...paperTextInputFontScalingProps,
    dense: true,
  } as const;

  return (
    <View
      style={[styles.screenRoot, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom + 12) },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        removeClippedSubviews={false}
        showsVerticalScrollIndicator
        persistentScrollbar={Platform.OS === 'android'}
      >
        <View style={styles.buildBanner}>
          <Text
            style={[styles.buildBannerText, { color: theme.colors.primary }]}
          >
            {t('settings.buildBanner', {
              mode: __DEV__
                ? t('settings.bundleModeMetro')
                : t('settings.bundleModeEmbedded'),
            })}
          </Text>
        </View>

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.account')}
          </List.Subheader>
          <List.Item
            {...compactListItemProps}
            title={userInfo.username || t('settings.accountNotLoggedIn')}
            description={userInfo.email || ''}
            descriptionNumberOfLines={1}
            left={props => <List.Icon {...props} icon="account" />}
          />
        </List.Section>

        <Divider />

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.debug')}
          </List.Subheader>
          <List.Item
            {...compactListItemProps}
            title={t('settings.debugPanelTitle')}
            description={t('settings.debugPanelDescription')}
            left={props => <List.Icon {...props} icon="bug-outline" />}
            right={() => (
              <Switch
                value={debugMode}
                onValueChange={value => {
                  dispatch(setDebugMode(value));
                }}
                color={theme.colors.primary}
              />
            )}
          />
          <List.Item
            {...compactListItemProps}
            title={t('settings.webviewDebugTitle')}
            description={t('settings.webviewDebugDescription')}
            left={props => <List.Icon {...props} icon="text-box-outline" />}
            onPress={() => {
              navigation.navigate('Home');
              bridge.send({
                type: 'webview:navigate',
                payload: { path: '/debug' },
              });
            }}
          />
        </List.Section>

        <Divider />

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.appearance')}
          </List.Subheader>
          <List.Item
            {...compactListItemProps}
            title={t('settings.darkMode')}
            left={props => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => (
              <Switch
                value={appTheme === 'dark'}
                onValueChange={value => {
                  const nextTheme = value ? 'dark' : 'light';
                  dispatch(setTheme(nextTheme));
                  bridge.send({
                    type: 'theme:change',
                    payload: { theme: nextTheme },
                  });
                }}
                color={theme.colors.primary}
              />
            )}
          />
          <List.Item
            {...compactListItemProps}
            title={t('settings.language')}
            description={
              language === 'en' ? t('language.english') : t('language.chinese')
            }
            left={props => <List.Icon {...props} icon="translate" />}
            right={() => (
              <Switch
                value={language === 'zh'}
                onValueChange={value => {
                  const nextLanguage = value ? 'zh' : 'en';
                  dispatch(setLanguage(nextLanguage));
                  bridge.send({
                    type: 'language:change',
                    payload: { lang: nextLanguage },
                  });
                }}
                color={theme.colors.primary}
              />
            )}
          />
        </List.Section>

        <Divider />

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.voice')}
          </List.Subheader>
          <List.Item
            {...compactListItemProps}
            title={t('settings.wakeWordTitle')}
            description={
              wakeWordEnabled
                ? wakeWordListening
                  ? t('settings.wakeWordListening')
                  : wakeWordModelLoaded
                    ? t('settings.wakeWordModelReady')
                    : t('settings.wakeWordModelLoading')
                : t('settings.wakeWordDescription')
            }
            left={props => <List.Icon {...props} icon="microphone" />}
            right={() => (
              <Switch
                value={wakeWordEnabled}
                onValueChange={toggleWakeWord}
                color={theme.colors.primary}
              />
            )}
          />
          {wakeWordEnabled && (
            <List.Item
              {...compactListItemProps}
              title={t('settings.wakeWordKeywordsTitle')}
              description={`${t('settings.wakeWordFallbackDescription')} ${wakeWordKeywords.join('、')}`}
              descriptionNumberOfLines={2}
              left={props => (
                <List.Icon {...props} icon="text-to-speech" />
              )}
              onPress={() => {
                setEditingWakeWords(wakeWordKeywords.join('\n'));
                setShowWakeWordDialog(true);
              }}
            />
          )}
          {wakeWordError && (
            <Text
              style={{
                color: theme.colors.error,
                fontSize: 11,
                paddingHorizontal: 16,
                marginTop: 4,
              }}
            >
              {wakeWordError}
            </Text>
          )}
        </List.Section>

        <Divider />

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.server')}
          </List.Subheader>
          <List.Item
            {...compactListItemProps}
            title={t('settings.serverUrlTitle')}
            description={serverUrl}
            descriptionNumberOfLines={1}
            left={props => <List.Icon {...props} icon="server" />}
            onPress={() => {
              setEditingUrl(serverUrl);
              setShowUrlDialog(true);
            }}
          />
          <List.Item
            {...compactListItemProps}
            title={t('settings.characterAssetsTitle')}
            description={
              characterAssetsBaseUrl.length > 0
                ? characterAssetsBaseUrl
                : t('settings.defaultSameAsApi', { serverUrl })
            }
            descriptionNumberOfLines={1}
            left={props => <List.Icon {...props} icon="human" />}
            onPress={() => {
              setEditingCharacterAssetsUrl(characterAssetsBaseUrl);
              setShowCharacterAssetsDialog(true);
            }}
          />
          <List.Item
            {...compactListItemProps}
            title={t('settings.sceneAssetsTitle')}
            description={
              sceneAssetsBaseUrl.length > 0
                ? sceneAssetsBaseUrl
                : t('settings.defaultSameAsApi', { serverUrl })
            }
            descriptionNumberOfLines={1}
            left={props => <List.Icon {...props} icon="image-filter-hdr" />}
            onPress={() => {
              setEditingSceneAssetsUrl(sceneAssetsBaseUrl);
              setShowSceneAssetsDialog(true);
            }}
          />
        </List.Section>

        <Divider />

        <List.Section style={styles.listSection}>
          <List.Subheader {...compactSubheaderProps}>
            {t('settings.sections.assets')}
          </List.Subheader>
          {nativeAssetDl.phase === 'idle' && nativeAssetDl.rows.length === 0 ? (
            <List.Item
              {...compactListItemProps}
              title={t('settings.nativeAssetsNotStartedTitle')}
              description={t('settings.nativeAssetsNotStartedDescription')}
              left={props => <List.Icon {...props} icon="package-variant" />}
            />
          ) : (
            <View style={styles.nativeAssetBlock}>
              {(() => {
                const total = nativeAssetDl.rows.length;
                const done = nativeAssetDl.rows.filter(
                  row => row.status === 'ok' || row.status === 'skipped',
                ).length;
                const pct = total > 0 ? done / total : 0;
                return (
                  <>
                    <Text
                      style={{
                        color: theme.colors.onSurface,
                        marginBottom: 6,
                        fontSize: 12,
                      }}
                    >
                      {nativeAssetDl.phase === 'running'
                        ? t('settings.nativeAssetsRunningProgress', {
                            done,
                            total,
                          })
                        : nativeAssetDl.phase === 'error'
                          ? t('settings.nativeAssetsFailedProgress', {
                              done,
                              total,
                            })
                          : t('settings.nativeAssetsCompletedProgress', {
                              done,
                              total,
                            })}
                    </Text>
                    {total > 0 ? (
                      <ProgressBar
                        progress={pct}
                        color={theme.colors.primary}
                      />
                    ) : null}
                    {nativeAssetDl.errorMessage ? (
                      <Text
                        style={{
                          color: theme.colors.error,
                          marginTop: 6,
                          fontSize: 11,
                        }}
                      >
                        {nativeAssetDl.errorMessage}
                      </Text>
                    ) : null}
                  </>
                );
              })()}
              <Text
                style={{
                  color: theme.colors.primary,
                  marginTop: 8,
                  marginBottom: 4,
                  fontSize: 11,
                }}
              >
                {t('settings.nativeAssetsCharacters')}
              </Text>
              {nativeAssetDl.rows
                .filter(row => row.group === 'character')
                .map(row => (
                  <List.Item
                    {...compactListItemProps}
                    key={row.rel}
                    title={row.label}
                    description={nativeAssetStatusDescription(row, t)}
                    left={props => (
                      <List.Icon
                        {...props}
                        icon={nativeAssetStatusIcon(row.status)}
                      />
                    )}
                  />
                ))}
              <Text
                style={{
                  color: theme.colors.primary,
                  marginTop: 6,
                  marginBottom: 4,
                  fontSize: 11,
                }}
              >
                {t('settings.nativeAssetsScenes')}
              </Text>
              {nativeAssetDl.rows
                .filter(row => row.group === 'scene')
                .map(row => (
                  <List.Item
                    {...compactListItemProps}
                    key={row.rel}
                    title={row.label}
                    description={nativeAssetStatusDescription(row, t)}
                    left={props => (
                      <List.Icon
                        {...props}
                        icon={nativeAssetStatusIcon(row.status)}
                      />
                    )}
                  />
                ))}
            </View>
          )}
        </List.Section>

        <Divider />

        <View style={styles.footer}>
          <Text
            style={[styles.version, { color: theme.colors.onSurface + '50' }]}
          >
            {t('settings.version')}
          </Text>
          <Button
            {...paperButtonFontScalingProps}
            mode="outlined"
            onPress={() => {
              bridge.send({ type: 'auth:logout', payload: {} });
              void logoutDashboardSession(serverUrl).catch(() => {
                /* ignore */
              });
              dispatch(logout());
            }}
            textColor={theme.colors.error}
            style={[styles.logoutButton, { borderColor: theme.colors.error }]}
            icon="logout"
          >
            {t('common.signOut')}
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={showUrlDialog}
          onDismiss={() => setShowUrlDialog(false)}
        >
          <Dialog.Title>{t('settings.dialogs.changeServerUrl')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              {...denseDialogInputProps}
              label={t('settings.dialogs.serverUrlLabel')}
              value={editingUrl}
              onChangeText={setEditingUrl}
              mode="outlined"
              placeholder={t('auth.serverPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              {...paperButtonFontScalingProps}
              onPress={() => setShowUrlDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button {...paperButtonFontScalingProps} onPress={handleSaveUrl}>
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showCharacterAssetsDialog}
          onDismiss={() => setShowCharacterAssetsDialog(false)}
        >
          <Dialog.Title>
            {t('settings.dialogs.characterAssetsTitle')}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              {t('settings.dialogs.characterAssetsHint')}
            </Text>
            <TextInput
              {...denseDialogInputProps}
              label={t('settings.dialogs.httpsRootAddress')}
              value={editingCharacterAssetsUrl}
              onChangeText={setEditingCharacterAssetsUrl}
              mode="outlined"
              placeholder="https://cdn.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              {...paperButtonFontScalingProps}
              onPress={() => setShowCharacterAssetsDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              {...paperButtonFontScalingProps}
              onPress={handleSaveCharacterAssetsUrl}
            >
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showWakeWordDialog}
          onDismiss={() => setShowWakeWordDialog(false)}
        >
          <Dialog.Title>{t('settings.wakeWordKeywordsTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              {t('settings.wakeWordKeywordsHint')}
            </Text>
            <TextInput
              {...denseDialogInputProps}
              value={editingWakeWords}
              onChangeText={setEditingWakeWords}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="你好小智"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              {...paperButtonFontScalingProps}
              onPress={() => setShowWakeWordDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              {...paperButtonFontScalingProps}
              onPress={() => {
                const newKeywords = editingWakeWords
                  .split('\n')
                  .map(k => k.trim())
                  .filter(k => k.length > 0);
                if (newKeywords.length > 0) {
                  dispatch(setWakeWordKeywords(newKeywords));
                }
                setShowWakeWordDialog(false);
              }}
            >
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showSceneAssetsDialog}
          onDismiss={() => setShowSceneAssetsDialog(false)}
        >
          <Dialog.Title>{t('settings.dialogs.sceneAssetsTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              {t('settings.dialogs.sceneAssetsHint')}
            </Text>
            <TextInput
              {...denseDialogInputProps}
              label={t('settings.dialogs.httpsRootAddress')}
              value={editingSceneAssetsUrl}
              onChangeText={setEditingSceneAssetsUrl}
              mode="outlined"
              placeholder="https://assets.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              {...paperButtonFontScalingProps}
              onPress={() => setShowSceneAssetsDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              {...paperButtonFontScalingProps}
              onPress={handleSaveSceneAssetsUrl}
            >
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {},
  listSection: {
    marginVertical: 2,
  },
  sectionSubheader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  listItem: {
    minHeight: 54,
    paddingVertical: 0,
  },
  listItemContent: {
    paddingVertical: 3,
  },
  listItemTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  listItemDescription: {
    fontSize: 11,
    lineHeight: 15,
  },
  buildBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  buildBannerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nativeAssetBlock: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  version: {
    fontSize: 11,
  },
  logoutButton: {
    width: '100%',
    borderRadius: 10,
  },
});
