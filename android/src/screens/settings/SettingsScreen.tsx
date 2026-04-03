import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
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
  RadioButton,
  ProgressBar,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import type { NativeAssetDownloadRow } from '@/store/nativeAssetDownloadSlice';
import {
  setLanguage,
  setTheme,
  setServerUrl,
  setCharacterAssetsBaseUrl,
  setSceneAssetsBaseUrl,
} from '@/store/appSlice';
import { logout } from '@/store/authSlice';
import { bridge } from '@/bridge/WebViewBridge';
import { HDRI_SCENE_NAMES } from '@/constants/hdriScenes';
import {
  fetchAvailableLlm,
  fetchCharacterConfig,
  saveConversationSettings,
  saveTtsSettings,
  savePrompt,
  saveScene,
  type CharacterConfigDto,
} from '@/services/characterSettingsApi';

type TabParamList = {
  Home: undefined;
  ChatList: undefined;
  Settings: undefined;
};

type SettingsTabNav = BottomTabNavigationProp<TabParamList, 'Settings'>;

function nativeAssetStatusDescription(row: NativeAssetDownloadRow): string {
  switch (row.status) {
    case 'pending':
      return '待拉取';
    case 'running':
      return '拉取中…';
    case 'ok':
      return '已缓存';
    case 'skipped':
      return '不可用（已跳过）';
    case 'error':
      return '失败';
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

export function SettingsScreen() {
  const theme = useTheme();
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
  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );

  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [editingUrl, setEditingUrl] = useState(serverUrl);
  const [showCharacterAssetsDialog, setShowCharacterAssetsDialog] =
    useState(false);
  const [editingCharacterAssetsUrl, setEditingCharacterAssetsUrl] =
    useState('');
  const [showSceneAssetsDialog, setShowSceneAssetsDialog] = useState(false);
  const [editingSceneAssetsUrl, setEditingSceneAssetsUrl] = useState('');

  const [config, setConfig] = useState<CharacterConfigDto | null>(null);
  const [llmOptions, setLlmOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [llmDialog, setLlmDialog] = useState(false);
  const [pickConv, setPickConv] = useState('');
  const [pickOverride, setPickOverride] = useState('');

  const [ttsAdapter, setTtsAdapter] = useState('');
  const [voice, setVoice] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState('1');

  const [promptText, setPromptText] = useState('');

  const [sceneDialog, setSceneDialog] = useState(false);
  const [pickScene, setPickScene] = useState('');

  const notifyWeb = useCallback(() => {
    bridge.send({
      type: 'config:update',
      payload: { source: 'native-settings' },
    });
  }, []);

  const loadCharacter = useCallback(async () => {
    if (!userInfo.id || !selectedCharacterId) {
      setConfig(null);
      setLlmOptions([]);
      return;
    }
    setLoading(true);
    try {
      const [cfg, llm] = await Promise.all([
        fetchCharacterConfig(serverUrl, userInfo.id, selectedCharacterId),
        fetchAvailableLlm(serverUrl, userInfo.id),
      ]);
      setConfig(cfg);
      setLlmOptions(llm.options?.length ? llm.options : []);
      setPickConv(cfg.conversation_adapter || '');
      setPickOverride(cfg.conversation_model_override || '');
      setTtsAdapter(cfg.tts_adapter || '');
      setVoice(cfg.voice || '');
      setVoiceSpeed(String(cfg.voice_speed ?? 1));
      setPromptText(cfg.prompt || '');
      setPickScene(cfg.scene_name || '');
    } catch (e) {
      Alert.alert(
        'Load failed',
        e instanceof Error ? e.message : 'Could not load character settings',
      );
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [userInfo.id, selectedCharacterId, serverUrl]);

  useFocusEffect(
    useCallback(() => {
      void loadCharacter();
    }, [loadCharacter]),
  );

  const readOnly = config?.read_only === true;

  const handleSaveUrl = () => {
    const trimmed = editingUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setServerUrl(trimmed));
      setShowUrlDialog(false);
    } else {
      Alert.alert('Invalid URL', 'Server URL must start with http:// or https://');
    }
  };

  const handleSaveCharacterAssetsUrl = () => {
    const t = editingCharacterAssetsUrl.trim().replace(/\/+$/, '');
    if (t.length === 0) {
      dispatch(setCharacterAssetsBaseUrl(''));
      setShowCharacterAssetsDialog(false);
      return;
    }
    if (t.startsWith('http://') || t.startsWith('https://')) {
      dispatch(setCharacterAssetsBaseUrl(t));
      setShowCharacterAssetsDialog(false);
    } else {
      Alert.alert(
        'Invalid URL',
        'Must start with http:// or https://, or leave empty to use Server URL',
      );
    }
  };

  const handleSaveSceneAssetsUrl = () => {
    const t = editingSceneAssetsUrl.trim().replace(/\/+$/, '');
    if (t.length === 0) {
      dispatch(setSceneAssetsBaseUrl(''));
      setShowSceneAssetsDialog(false);
      return;
    }
    if (t.startsWith('http://') || t.startsWith('https://')) {
      dispatch(setSceneAssetsBaseUrl(t));
      setShowSceneAssetsDialog(false);
    } else {
      Alert.alert(
        'Invalid URL',
        'Must start with http:// or https://, or leave empty to use Server URL',
      );
    }
  };

  const runSave = async (key: string, fn: () => Promise<unknown>) => {
    if (!userInfo.id || !selectedCharacterId) return;
    setSaving(key);
    try {
      await fn();
      notifyWeb();
      await loadCharacter();
      Alert.alert('Saved');
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Request failed',
      );
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLlm = () =>
    runSave('llm', () =>
      saveConversationSettings(
        serverUrl,
        userInfo.id,
        selectedCharacterId!,
        pickConv,
        pickOverride,
      ),
    );

  const handleSaveTts = () => {
    const spd = parseFloat(voiceSpeed);
    return runSave('tts', () =>
      saveTtsSettings(
        serverUrl,
        userInfo.id,
        selectedCharacterId!,
        ttsAdapter,
        voice,
        Number.isFinite(spd) ? spd : 1,
      ),
    );
  };

  const handleSavePrompt = () =>
    runSave('prompt', () =>
      savePrompt(serverUrl, userInfo.id, selectedCharacterId!, promptText),
    );

  const handleSaveScene = () =>
    runSave('scene', () =>
      saveScene(serverUrl, userInfo.id, selectedCharacterId!, pickScene),
    );

  return (
    <View
      style={[
        styles.screenRoot,
        { backgroundColor: theme.colors.background },
      ]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        removeClippedSubviews={false}
        showsVerticalScrollIndicator
        persistentScrollbar={Platform.OS === 'android'}>
        <View style={styles.buildBanner}>
          <Text
            style={[styles.buildBannerText, { color: theme.colors.primary }]}>
            JS settings-ui v7 ·{' '}
            {__DEV__ ? 'Metro 热更新' : '内置 bundle'}
          </Text>
        </View>
      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>Account</List.Subheader>
        <List.Item
          title={userInfo.username || 'Not logged in'}
          description={userInfo.email || ''}
          left={props => <List.Icon {...props} icon="account" />}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>调试</List.Subheader>
        <List.Item
          title="日志 / 调试页"
          description="在嵌入的 WebView 中打开简要说明页（调试用 Chrome/远程调试即可）"
          left={props => <List.Icon {...props} icon="text-box-outline" />}
          onPress={() => {
            navigation.navigate('Home');
            bridge.send({
              type: 'webview:navigate',
              payload: { path: '/debug' },
            });
          }}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>Appearance</List.Subheader>
        <List.Item
          title="Dark Mode"
          left={props => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => (
            <Switch
              value={appTheme === 'dark'}
              onValueChange={(v: boolean) => {
                const next = v ? 'dark' : 'light';
                dispatch(setTheme(next));
                bridge.send({
                  type: 'theme:change',
                  payload: { theme: next },
                });
              }}
              color={theme.colors.primary}
            />
          )}
          titleStyle={{ color: theme.colors.onSurface }}
        />
        <List.Item
          title="Language"
          description={language === 'en' ? 'English' : '中文'}
          left={props => <List.Icon {...props} icon="translate" />}
          right={() => (
            <Switch
              value={language === 'zh'}
              onValueChange={(v: boolean) => {
                const lang = v ? 'zh' : 'en';
                dispatch(setLanguage(lang));
                bridge.send({
                  type: 'language:change',
                  payload: { lang },
                });
              }}
              color={theme.colors.primary}
            />
          )}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>Server</List.Subheader>
        <List.Item
          title="Server URL (API)"
          description={serverUrl}
          left={props => <List.Icon {...props} icon="server" />}
          onPress={() => {
            setEditingUrl(serverUrl);
            setShowUrlDialog(true);
          }}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
        <List.Item
          title="角色模型资源根 URL"
          description={
            characterAssetsBaseUrl.length > 0
              ? characterAssetsBaseUrl
              : `默认与 API 相同 · ${serverUrl}`
          }
          left={props => <List.Icon {...props} icon="human" />}
          onPress={() => {
            setEditingCharacterAssetsUrl(characterAssetsBaseUrl);
            setShowCharacterAssetsDialog(true);
          }}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
        <List.Item
          title="场景资源根 URL（地面 / HDR）"
          description={
            sceneAssetsBaseUrl.length > 0
              ? sceneAssetsBaseUrl
              : `默认与 API 相同 · ${serverUrl}`
          }
          left={props => <List.Icon {...props} icon="image-filter-hdr" />}
          onPress={() => {
            setEditingSceneAssetsUrl(sceneAssetsBaseUrl);
            setShowSceneAssetsDialog(true);
          }}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader style={{ color: theme.colors.primary }}>
          Character settings
        </List.Subheader>
        {Platform.OS === 'android' && (
          <>
            <List.Subheader style={{ fontSize: 13, opacity: 0.85 }}>
              3D 模型与场景缓存
            </List.Subheader>
            {nativeAssetDl.phase === 'idle' &&
            nativeAssetDl.rows.length === 0 ? (
              <List.Item
                title="尚未开始拉取"
                description="打开 Home 后会按静态资源地址下载；此处显示每个文件状态与总进度。"
                left={props => <List.Icon {...props} icon="package-variant" />}
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurface + '70' }}
              />
            ) : (
              <View style={styles.nativeAssetBlock}>
                {(() => {
                  const total = nativeAssetDl.rows.length;
                  const done = nativeAssetDl.rows.filter(
                    r => r.status === 'ok' || r.status === 'skipped',
                  ).length;
                  const pct = total > 0 ? done / total : 0;
                  return (
                    <>
                      <Text
                        style={{
                          color: theme.colors.onSurface,
                          marginBottom: 8,
                          fontSize: 13,
                        }}>
                        {nativeAssetDl.phase === 'running'
                          ? `拉取中 ${done}/${total}（404 会先 HEAD 快速跳过）`
                          : nativeAssetDl.phase === 'error'
                            ? `上次失败 ${done}/${total}`
                            : `已完成 ${done}/${total}`}
                      </Text>
                      {total > 0 ? (
                        <ProgressBar progress={pct} color={theme.colors.primary} />
                      ) : null}
                      {nativeAssetDl.errorMessage ? (
                        <Text
                          style={{
                            color: theme.colors.error,
                            marginTop: 8,
                            fontSize: 12,
                          }}>
                          {nativeAssetDl.errorMessage}
                        </Text>
                      ) : null}
                    </>
                  );
                })()}
                <Text
                  style={{
                    color: theme.colors.primary,
                    marginTop: 12,
                    marginBottom: 4,
                    fontSize: 12,
                  }}>
                  角色模型
                </Text>
                {nativeAssetDl.rows
                  .filter(r => r.group === 'character')
                  .map(row => (
                    <List.Item
                      key={row.rel}
                      title={row.label}
                      description={nativeAssetStatusDescription(row)}
                      left={props => (
                        <List.Icon
                          {...props}
                          icon={nativeAssetStatusIcon(row.status)}
                        />
                      )}
                      titleStyle={{ color: theme.colors.onSurface }}
                      descriptionStyle={{
                        color: theme.colors.onSurface + '70',
                      }}
                    />
                  ))}
                <Text
                  style={{
                    color: theme.colors.primary,
                    marginTop: 8,
                    marginBottom: 4,
                    fontSize: 12,
                  }}>
                  场景（地面 / HDR）
                </Text>
                {nativeAssetDl.rows
                  .filter(r => r.group === 'scene')
                  .map(row => (
                    <List.Item
                      key={row.rel}
                      title={row.label}
                      description={nativeAssetStatusDescription(row)}
                      left={props => (
                        <List.Icon
                          {...props}
                          icon={nativeAssetStatusIcon(row.status)}
                        />
                      )}
                      titleStyle={{ color: theme.colors.onSurface }}
                      descriptionStyle={{
                        color: theme.colors.onSurface + '70',
                      }}
                    />
                  ))}
              </View>
            )}
            <Divider />
          </>
        )}
        {!selectedCharacterId ? (
          <List.Item
            title="No character selected"
            description="Open Chats and pick a conversation first."
            left={props => <List.Icon {...props} icon="information" />}
            titleStyle={{ color: theme.colors.onSurface }}
          />
        ) : loading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
          </View>
        ) : config ? (
          <>
            <List.Item
              title={config.character_name}
              description={readOnly ? 'Read-only template' : 'Active character'}
              left={props => <List.Icon {...props} icon="account-circle" />}
              titleStyle={{ color: theme.colors.onSurface }}
            />

            <List.Item
              title="LLM (conversation)"
              description={`${pickConv || '—'}${pickOverride ? ` · ${pickOverride}` : ''}`}
              left={props => <List.Icon {...props} icon="brain" />}
              onPress={() => !readOnly && setLlmDialog(true)}
              disabled={readOnly}
              titleStyle={{ color: theme.colors.onSurface }}
            />
            {!readOnly && (
              <View style={styles.rowBtn}>
                <Button
                  mode="contained-tonal"
                  onPress={() => void handleSaveLlm()}
                  disabled={saving !== null}
                  loading={saving === 'llm'}>
                  Save LLM
                </Button>
              </View>
            )}

            <List.Subheader>TTS</List.Subheader>
            <View style={styles.pad}>
              <TextInput
                label="TTS adapter"
                value={ttsAdapter}
                onChangeText={setTtsAdapter}
                mode="outlined"
                dense
                disabled={readOnly}
              />
              <TextInput
                label="Voice"
                value={voice}
                onChangeText={setVoice}
                mode="outlined"
                dense
                style={styles.inputGap}
                disabled={readOnly}
              />
              <TextInput
                label="Voice speed"
                value={voiceSpeed}
                onChangeText={setVoiceSpeed}
                mode="outlined"
                keyboardType="decimal-pad"
                dense
                style={styles.inputGap}
                disabled={readOnly}
              />
              {!readOnly && (
                <Button
                  mode="contained-tonal"
                  style={styles.inputGap}
                  onPress={() => void handleSaveTts()}
                  disabled={saving !== null}
                  loading={saving === 'tts'}>
                  Save TTS
                </Button>
              )}
            </View>

            <List.Subheader>Prompt</List.Subheader>
            <View style={styles.pad}>
              <TextInput
                label="System prompt"
                value={promptText}
                onChangeText={setPromptText}
                mode="outlined"
                multiline
                numberOfLines={6}
                disabled={readOnly}
              />
              {!readOnly && (
                <Button
                  mode="contained-tonal"
                  style={styles.inputGap}
                  onPress={() => void handleSavePrompt()}
                  disabled={saving !== null}
                  loading={saving === 'prompt'}>
                  Save prompt
                </Button>
              )}
            </View>

            <List.Item
              title="Scene (HDRI)"
              description={pickScene || '—'}
              left={props => <List.Icon {...props} icon="image-filter-hdr" />}
              onPress={() => !readOnly && setSceneDialog(true)}
              disabled={readOnly}
              titleStyle={{ color: theme.colors.onSurface }}
            />
            {!readOnly && (
              <View style={styles.rowBtn}>
                <Button
                  mode="contained-tonal"
                  onPress={() => void handleSaveScene()}
                  disabled={saving !== null}
                  loading={saving === 'scene'}>
                  Save scene
                </Button>
              </View>
            )}
          </>
        ) : null}
      </List.Section>

      <Divider />

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.colors.onSurface + '50' }]}>
          DLP3D Android v0.1.0
        </Text>
        <Button
          mode="outlined"
          onPress={() => dispatch(logout())}
          textColor={theme.colors.error}
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          icon="logout">
          Sign Out
        </Button>
      </View>
      </ScrollView>

      <Portal>
        <Dialog visible={showUrlDialog} onDismiss={() => setShowUrlDialog(false)}>
          <Dialog.Title>Change Server URL</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Server URL"
              value={editingUrl}
              onChangeText={setEditingUrl}
              mode="outlined"
              placeholder="https://your-server.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowUrlDialog(false)}>Cancel</Button>
            <Button onPress={handleSaveUrl}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showCharacterAssetsDialog}
          onDismiss={() => setShowCharacterAssetsDialog(false)}>
          <Dialog.Title>角色模型资源根 URL</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              需与站点上 public/characters/ 路径一致。留空则使用上方 API Server
              URL。
            </Text>
            <TextInput
              label="HTTPS 根地址"
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
            <Button onPress={() => setShowCharacterAssetsDialog(false)}>
              Cancel
            </Button>
            <Button onPress={handleSaveCharacterAssetsUrl}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showSceneAssetsDialog}
          onDismiss={() => setShowSceneAssetsDialog(false)}>
          <Dialog.Title>场景资源根 URL</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              需包含 public/models/ground/ 与 public/img/hdr/。留空则使用 API
              Server URL。
            </Text>
            <TextInput
              label="HTTPS 根地址"
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
            <Button onPress={() => setShowSceneAssetsDialog(false)}>
              Cancel
            </Button>
            <Button onPress={handleSaveSceneAssetsUrl}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={llmDialog} onDismiss={() => setLlmDialog(false)}>
          <Dialog.Title>Conversation model</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 320 }}>
              {llmOptions.length === 0 ? (
                <Text>No LLM options from server</Text>
              ) : (
                <RadioButton.Group value={pickConv} onValueChange={setPickConv}>
                  {llmOptions.map(opt => (
                    <RadioButton.Item key={opt} label={opt} value={opt} />
                  ))}
                </RadioButton.Group>
              )}
              <TextInput
                label="Model override (optional)"
                value={pickOverride}
                onChangeText={setPickOverride}
                mode="outlined"
                style={{ marginTop: 12 }}
              />
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLlmDialog(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={sceneDialog} onDismiss={() => setSceneDialog(false)}>
          <Dialog.Title>Scene</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 360 }}>
              <RadioButton.Group value={pickScene} onValueChange={setPickScene}>
                {HDRI_SCENE_NAMES.map(name => (
                  <RadioButton.Item key={name} label={name} value={name} />
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSceneDialog(false)}>Done</Button>
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
  buildBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buildBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerPad: {
    padding: 24,
    alignItems: 'center',
  },
  nativeAssetBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  inputGap: {
    marginTop: 8,
  },
  rowBtn: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  version: {
    fontSize: 12,
  },
  logoutButton: {
    width: '100%',
    borderRadius: 12,
  },
});
