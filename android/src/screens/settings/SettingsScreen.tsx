import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import {
  Text,
  List,
  Divider,
  useTheme,
  Button,
  Portal,
  TextInput,
  Chip,
  MD3Theme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setSettingsCharacterId } from '@/store/chatSlice';
import { bridge } from '@/bridge/WebViewBridge';
import {
  HDRI_SCENE_NAMES,
  normalizeHdriSceneName,
  resolveHdriPreviewUri,
} from '@/constants/hdriScenes';
import {
  fetchAvailableLlm,
  fetchAvailableAsr,
  fetchAvailableTts,
  fetchConversationChoices,
  fetchAsrChoices,
  fetchTtsChoices,
  fetchTtsVoiceNames,
  fetchCharacterConfig,
  fetchDashboardCharacter,
  patchDashboardCharacter,
  type CharacterConfigDto,
} from '@/services/characterSettingsApi';
import { useTranslation } from 'react-i18next';
import { restoreDashboardSession } from '@/services/api';
import {
  paperButtonFontScalingProps,
  paperChipFontScalingProps,
  paperListItemFontScalingProps,
  paperSubheaderFontScalingProps,
  paperTextInputFontScalingProps,
} from '@/theme/fontScaling';

function mergeChoicesWithCurrent(
  choices: string[],
  currentValue: string | undefined,
): string[] {
  if (!currentValue || choices.includes(currentValue)) {
    return choices;
  }
  return [currentValue, ...choices];
}

function isChoiceAvailable(
  choice: string,
  availableProviders: string[],
): boolean {
  return availableProviders.some(
    provider => choice === provider || choice.startsWith(provider),
  );
}

function getSceneLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  sceneName: string,
): string {
  return t(`settings.scenes.${sceneName}`, { defaultValue: sceneName });
}

interface VoiceOption {
  value: string;
  label: string;
}

function getVoiceLabel(voiceOptions: VoiceOption[], voiceId: string): string {
  const matched = voiceOptions.find(option => option.value === voiceId);
  return matched?.label || voiceId;
}

function getAvailabilityDescription(
  t: (key: string, options?: Record<string, unknown>) => string,
  available: boolean,
  enabledLabel: string,
): string {
  return available ? enabledLabel : t('settings.unavailable');
}

const SPEED_MARKS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;
const SPEED_STEP = 0.1;

function clampSpeed(value: number): number {
  const rounded = Math.round(value / SPEED_STEP) * SPEED_STEP;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, Number(rounded.toFixed(2))));
}

interface BottomSheetProps {
  onClose: () => void;
  title: string;
  theme: MD3Theme;
  closeLabel: string;
  children: React.ReactNode;
}

function BottomSheet({
  onClose,
  title,
  theme,
  closeLabel,
  children,
}: BottomSheetProps) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          <Button {...paperButtonFontScalingProps} compact onPress={onClose}>
            {closeLabel}
          </Button>
        </View>
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );
  const settingsCharacterId = useSelector(
    (state: RootState) => state.chat.settingsCharacterId,
  );
  const activeCharacterId = settingsCharacterId ?? selectedCharacterId;

  const [config, setConfig] = useState<CharacterConfigDto | null>(null);
  const [llmAvailableProviders, setLlmAvailableProviders] = useState<string[]>(
    [],
  );
  const [asrAvailableProviders, setAsrAvailableProviders] = useState<string[]>(
    [],
  );
  const [ttsAvailableProviders, setTtsAvailableProviders] = useState<string[]>(
    [],
  );
  const [conversationChoices, setConversationChoices] = useState<string[]>([]);
  const [asrChoices, setAsrChoices] = useState<string[]>([]);
  const [ttsChoices, setTtsChoices] = useState<string[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const [llmDialog, setLlmDialog] = useState(false);
  const [pickConv, setPickConv] = useState('');
  const [pickOverride, setPickOverride] = useState('');
  const [asrDialog, setAsrDialog] = useState(false);
  const [pickAsr, setPickAsr] = useState('');
  const [ttsDialog, setTtsDialog] = useState(false);
  const [voiceDialog, setVoiceDialog] = useState(false);

  const [ttsAdapter, setTtsAdapter] = useState('');
  const [voice, setVoice] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState('1');
  const [promptText, setPromptText] = useState('');

  const [sceneDialog, setSceneDialog] = useState(false);
  const [pickScene, setPickScene] = useState('');

  const applyConfig = useCallback((cfg: CharacterConfigDto) => {
    setConfig(cfg);
    setPickConv(cfg.conversation_adapter || '');
    setPickOverride(cfg.conversation_model_override || '');
    setPickAsr(cfg.asr_adapter || '');
    setTtsAdapter(cfg.tts_adapter || '');
    setVoice(cfg.voice || '');
    setVoiceSpeed(String(cfg.voice_speed ?? 1));
    setPromptText(cfg.prompt || '');
    setPickScene(normalizeHdriSceneName(cfg.scene_name));
  }, []);

  const notifyWeb = useCallback(() => {
    bridge.send({
      type: 'config:update',
      payload: { source: 'native-settings' },
    });
  }, []);

  const loadCharacter = useCallback(async () => {
    if (!userInfo.id || !activeCharacterId) {
      setConfig(null);
      setLlmAvailableProviders([]);
      setAsrAvailableProviders([]);
      setTtsAvailableProviders([]);
      setConversationChoices([]);
      setAsrChoices([]);
      setTtsChoices([]);
      setVoiceOptions([]);
      return;
    }

    setLoading(true);
    try {
      const loadDashboardConfig = async () => {
        try {
          return await fetchDashboardCharacter(serverUrl, activeCharacterId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            userInfo.email &&
            (message.includes('401') || message.includes('Unauthorized'))
          ) {
            const restored = await restoreDashboardSession(
              serverUrl,
              userInfo.email,
            );
            if (restored) {
              return fetchDashboardCharacter(serverUrl, activeCharacterId);
            }
          }
          return fetchCharacterConfig(
            serverUrl,
            userInfo.id,
            activeCharacterId,
          );
        }
      };

      const [
        cfg,
        llm,
        asr,
        tts,
        llmChoices,
        speechChoices,
        speechSynthesisChoices,
      ] = await Promise.all([
        loadDashboardConfig(),
        fetchAvailableLlm(serverUrl, userInfo.id),
        fetchAvailableAsr(serverUrl, userInfo.id),
        fetchAvailableTts(serverUrl, userInfo.id),
        fetchConversationChoices(serverUrl),
        fetchAsrChoices(serverUrl),
        fetchTtsChoices(serverUrl),
      ]);

      applyConfig(cfg);
      setLlmAvailableProviders(llm.options?.length ? llm.options : []);
      setAsrAvailableProviders(asr.options?.length ? asr.options : []);
      setTtsAvailableProviders(tts.options?.length ? tts.options : []);
      setConversationChoices(
        mergeChoicesWithCurrent(
          llmChoices.choices?.length ? llmChoices.choices : [],
          cfg.conversation_adapter,
        ),
      );
      setAsrChoices(
        mergeChoicesWithCurrent(
          speechChoices.choices?.length ? speechChoices.choices : [],
          cfg.asr_adapter,
        ),
      );
      setTtsChoices(
        mergeChoicesWithCurrent(
          speechSynthesisChoices.choices?.length
            ? speechSynthesisChoices.choices
            : [],
          cfg.tts_adapter,
        ),
      );
    } catch (error) {
      Alert.alert(
        t('settings.alerts.loadFailedTitle'),
        error instanceof Error
          ? error.message
          : t('settings.alerts.loadFailedMessage'),
      );
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [
    activeCharacterId,
    applyConfig,
    serverUrl,
    t,
    userInfo.email,
    userInfo.id,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadCharacter();
      return () => {
        dispatch(setSettingsCharacterId(null));
      };
    }, [dispatch, loadCharacter]),
  );

  const readOnly = config?.read_only === true;

  useEffect(() => {
    if (!ttsAdapter) {
      setVoiceOptions([]);
      return;
    }

    let cancelled = false;
    setVoiceLoading(true);
    fetchTtsVoiceNames(serverUrl, ttsAdapter)
      .then(result => {
        if (cancelled) {
          return;
        }
        const options = Object.entries(result.voice_names ?? {}).map(
          ([value, label]) => ({
            value: String(value),
            label: typeof label === 'string' ? label : String(value),
          }),
        );
        setVoiceOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setVoiceOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVoiceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serverUrl, ttsAdapter]);

  useEffect(() => {
    if (!config || readOnly || !activeCharacterId || !ttsAdapter) {
      return;
    }

    const parsedSpeed = parseFloat(voiceSpeed);
    if (!Number.isFinite(parsedSpeed)) {
      return;
    }

    const normalizedSpeed = clampSpeed(parsedSpeed);
    if (
      config.tts_adapter === ttsAdapter &&
      config.voice === voice &&
      Math.abs((config.voice_speed ?? 1) - normalizedSpeed) < 0.001
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void runSave('tts', () =>
        patchDashboardCharacter(serverUrl, activeCharacterId, {
          tts_adapter: ttsAdapter,
          voice,
          voice_speed: normalizedSpeed,
        }),
      );
    }, 650);

    return () => clearTimeout(timer);
  }, [
    activeCharacterId,
    config,
    readOnly,
    serverUrl,
    ttsAdapter,
    voice,
    voiceSpeed,
  ]);

  const runSave = async (key: string, fn: () => Promise<unknown>) => {
    if (!userInfo.id || !activeCharacterId) {
      return;
    }
    setSaving(key);
    try {
      await fn();
      notifyWeb();
      await loadCharacter();
      Alert.alert(t('common.saved'));
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error
          ? error.message
          : t('settings.alerts.requestFailed'),
      );
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLlm = () =>
    runSave('llm', () =>
      patchDashboardCharacter(serverUrl, activeCharacterId!, {
        conversation_adapter: pickConv,
        conversation_model_override: pickOverride,
      }),
    );

  const handleSaveTts = () => {
    const parsedSpeed = clampSpeed(parseFloat(voiceSpeed));
    return runSave('tts', () =>
      patchDashboardCharacter(serverUrl, activeCharacterId!, {
        tts_adapter: ttsAdapter,
        voice,
        voice_speed: Number.isFinite(parsedSpeed) ? parsedSpeed : 1,
      }),
    );
  };

  const adjustVoiceSpeed = (delta: number) => {
    const current = Number.parseFloat(voiceSpeed);
    const base = Number.isFinite(current) ? current : 1;
    setVoiceSpeed(
      clampSpeed(base + delta)
        .toFixed(2)
        .replace(/\.00$/, '.0'),
    );
  };

  const selectVoiceSpeed = (value: number) => {
    setVoiceSpeed(value.toFixed(2).replace(/\.00$/, '.0'));
  };

  const handleSaveAsr = () =>
    runSave('asr', () =>
      patchDashboardCharacter(serverUrl, activeCharacterId!, {
        asr_adapter: pickAsr,
      }),
    );

  const handleSavePrompt = () =>
    runSave('prompt', () =>
      patchDashboardCharacter(serverUrl, activeCharacterId!, {
        prompt: promptText,
      }),
    );

  const handleSaveScene = () =>
    runSave('scene', () =>
      patchDashboardCharacter(serverUrl, activeCharacterId!, {
        scene_name: pickScene,
      }),
    );

  const renderAdapterCards = (
    options: string[],
    selectedValue: string,
    availableProviders: string[],
    onSelect: (value: string) => void,
    enabledLabel: string,
  ) => {
    if (options.length === 0) {
      return null;
    }

    return (
      <View style={styles.choiceStack}>
        {options.map(option => {
          const selected = selectedValue === option;
          const available = isChoiceAvailable(option, availableProviders);
          return (
            <Pressable
              key={option}
              style={[
                styles.optionCard,
                {
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.outline + '40',
                  backgroundColor: theme.colors.surfaceVariant,
                  opacity: available ? 1 : 0.48,
                },
              ]}
              onPress={() => onSelect(option)}
            >
              <View style={styles.optionTextBlock}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {option}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {getAvailabilityDescription(t, available, enabledLabel)}
                </Text>
              </View>
              {selected ? (
                <Chip {...paperChipFontScalingProps} compact>
                  {t('common.selected')}
                </Chip>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
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

  const denseTextInputProps = {
    ...paperTextInputFontScalingProps,
    dense: true,
  } as const;

  const compactActionButtonProps = {
    ...paperButtonFontScalingProps,
    compact: true,
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
      >
        {!activeCharacterId ? (
          <List.Section style={styles.listSection}>
            <List.Item
              {...compactListItemProps}
              title={t('settings.noCharacterSelectedTitle')}
              description={t('settings.noCharacterSelectedDescription')}
              left={props => <List.Icon {...props} icon="information" />}
            />
          </List.Section>
        ) : loading ? (
          <View style={styles.centerPad}>
            <ActivityIndicator />
          </View>
        ) : config ? (
          <>
            <List.Section style={styles.listSection}>
              <List.Item
                {...compactListItemProps}
                title={config.character_name}
                description={
                  readOnly
                    ? t('settings.readOnlyTemplate')
                    : t('settings.activeCharacter')
                }
                left={props => <List.Icon {...props} icon="account-circle" />}
              />
            </List.Section>

            <Divider />

            <List.Section style={styles.listSection}>
              <List.Subheader {...compactSubheaderProps}>
                {t('settings.sections.characterSettings')}
              </List.Subheader>

              <List.Item
                {...compactListItemProps}
                title={t('settings.llmConversation')}
                description={`${pickConv || '—'}${
                  pickOverride ? ` · ${pickOverride}` : ''
                }`}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="brain" />}
                onPress={() => !readOnly && setLlmDialog(true)}
                disabled={readOnly}
              />
              {!readOnly ? (
                <View style={styles.rowBtn}>
                  <Button
                    {...compactActionButtonProps}
                    mode="contained-tonal"
                    onPress={() => void handleSaveLlm()}
                    disabled={saving !== null}
                    loading={saving === 'llm'}
                  >
                    {t('settings.saveLlm')}
                  </Button>
                </View>
              ) : null}

              <List.Item
                {...compactListItemProps}
                title={t('settings.asrRecognition')}
                description={pickAsr || '—'}
                descriptionNumberOfLines={1}
                left={props => (
                  <List.Icon {...props} icon="microphone-message" />
                )}
                onPress={() => !readOnly && setAsrDialog(true)}
                disabled={readOnly}
              />
              {!readOnly ? (
                <View style={styles.rowBtn}>
                  <Button
                    {...compactActionButtonProps}
                    mode="contained-tonal"
                    onPress={() => void handleSaveAsr()}
                    disabled={saving !== null}
                    loading={saving === 'asr'}
                  >
                    {t('settings.saveAsr')}
                  </Button>
                </View>
              ) : null}

              <List.Subheader {...compactSubheaderProps}>
                {t('settings.tts')}
              </List.Subheader>
              <List.Item
                {...compactListItemProps}
                title={t('settings.ttsAdapter')}
                description={ttsAdapter || '—'}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="speaker-multiple" />}
                onPress={() => !readOnly && setTtsDialog(true)}
                disabled={readOnly}
              />
              <List.Item
                {...compactListItemProps}
                title={t('settings.voice')}
                description={voice ? getVoiceLabel(voiceOptions, voice) : '—'}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="account-voice" />}
                onPress={() => !readOnly && ttsAdapter && setVoiceDialog(true)}
                disabled={readOnly || !ttsAdapter}
              />
              <View style={styles.pad}>
                <Text
                  style={[
                    styles.speedHeading,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t('settings.voiceSpeed')}:{' '}
                  {clampSpeed(parseFloat(voiceSpeed) || 1).toFixed(1)}x
                </Text>
                <Text
                  style={[
                    styles.speedHint,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t('settings.voiceSpeedHint')}
                </Text>
                <View
                  style={[
                    styles.speedRail,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  {SPEED_MARKS.map(mark => {
                    const selected =
                      Math.abs((parseFloat(voiceSpeed) || 1) - mark) < 0.001;
                    return (
                      <Pressable
                        key={mark}
                        onPress={() => selectVoiceSpeed(mark)}
                        disabled={readOnly}
                        style={[
                          styles.speedMark,
                          {
                            backgroundColor: selected
                              ? theme.colors.primary
                              : theme.colors.background,
                            borderColor: selected
                              ? theme.colors.primary
                              : theme.colors.outline + '50',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.speedMarkLabel,
                            {
                              color: selected
                                ? theme.colors.onPrimary
                                : theme.colors.onSurface,
                            },
                          ]}
                        >
                          {mark
                            .toFixed(mark % 1 === 0 ? 1 : 2)
                            .replace(/0$/, '')}
                          x
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.speedAdjustRow}>
                  <Button
                    {...paperButtonFontScalingProps}
                    mode="outlined"
                    compact
                    onPress={() => adjustVoiceSpeed(-SPEED_STEP)}
                    disabled={readOnly}
                  >
                    {t('settings.slower')}
                  </Button>
                  <View
                    style={[
                      styles.speedValuePill,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={[
                        styles.speedValueText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {clampSpeed(parseFloat(voiceSpeed) || 1).toFixed(1)}x
                    </Text>
                  </View>
                  <Button
                    {...paperButtonFontScalingProps}
                    mode="outlined"
                    compact
                    onPress={() => adjustVoiceSpeed(SPEED_STEP)}
                    disabled={readOnly}
                  >
                    {t('settings.faster')}
                  </Button>
                </View>
                {!readOnly ? (
                  <Button
                    {...compactActionButtonProps}
                    mode="contained-tonal"
                    style={styles.inputGap}
                    onPress={() => void handleSaveTts()}
                    disabled={saving !== null || !ttsAdapter}
                    loading={saving === 'tts'}
                  >
                    {t('settings.saveTts')}
                  </Button>
                ) : null}
              </View>

              <List.Subheader {...compactSubheaderProps}>
                {t('settings.prompt')}
              </List.Subheader>
              <View style={styles.pad}>
                <TextInput
                  {...paperTextInputFontScalingProps}
                  label={t('settings.systemPrompt')}
                  value={promptText}
                  onChangeText={setPromptText}
                  mode="outlined"
                  multiline
                  numberOfLines={5}
                  disabled={readOnly}
                />
                {!readOnly ? (
                  <Button
                    {...compactActionButtonProps}
                    mode="contained-tonal"
                    style={styles.inputGap}
                    onPress={() => void handleSavePrompt()}
                    disabled={saving !== null}
                    loading={saving === 'prompt'}
                  >
                    {t('settings.savePrompt')}
                  </Button>
                ) : null}
              </View>

              <List.Item
                {...compactListItemProps}
                title={t('settings.sceneHdri')}
                description={pickScene ? getSceneLabel(t, pickScene) : '—'}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="image-filter-hdr" />}
                onPress={() => !readOnly && setSceneDialog(true)}
                disabled={readOnly}
              />
              {!readOnly ? (
                <View style={styles.rowBtn}>
                  <Button
                    {...compactActionButtonProps}
                    mode="contained-tonal"
                    onPress={() => void handleSaveScene()}
                    disabled={saving !== null}
                    loading={saving === 'scene'}
                  >
                    {t('settings.saveScene')}
                  </Button>
                </View>
              ) : null}
            </List.Section>
          </>
        ) : null}
      </ScrollView>

      <Portal>
        {llmDialog ? (
          <BottomSheet
            onClose={() => setLlmDialog(false)}
            title={t('settings.dialogs.conversationModel')}
            theme={theme}
            closeLabel={t('common.done')}
          >
            {conversationChoices.length === 0 ? (
              <Text>{t('settings.dialogs.noConversationChoices')}</Text>
            ) : (
              renderAdapterCards(
                conversationChoices,
                pickConv,
                llmAvailableProviders,
                setPickConv,
                t('settings.dialogs.conversationModel'),
              )
            )}
            <TextInput
              {...denseTextInputProps}
              label={t('settings.dialogs.conversationAdapter')}
              value={pickConv}
              onChangeText={setPickConv}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inputGap}
            />
            <TextInput
              {...denseTextInputProps}
              label={t('settings.dialogs.modelOverrideOptional')}
              value={pickOverride}
              onChangeText={setPickOverride}
              mode="outlined"
              style={styles.inputGap}
            />
            <Text style={styles.sheetHint}>
              {t('settings.dialogs.conversationAdapterHint')}
            </Text>
          </BottomSheet>
        ) : null}

        {asrDialog ? (
          <BottomSheet
            onClose={() => setAsrDialog(false)}
            title={t('settings.dialogs.speechRecognition')}
            theme={theme}
            closeLabel={t('common.done')}
          >
            {asrChoices.length === 0 ? (
              <Text>{t('settings.dialogs.noAsrChoices')}</Text>
            ) : (
              renderAdapterCards(
                asrChoices,
                pickAsr,
                asrAvailableProviders,
                setPickAsr,
                t('settings.dialogs.speechRecognition'),
              )
            )}
            <TextInput
              {...denseTextInputProps}
              label={t('settings.dialogs.asrAdapter')}
              value={pickAsr}
              onChangeText={setPickAsr}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inputGap}
            />
            <Text style={styles.sheetHint}>
              {t('settings.dialogs.asrAdapterHint')}
            </Text>
          </BottomSheet>
        ) : null}

        {ttsDialog ? (
          <BottomSheet
            onClose={() => setTtsDialog(false)}
            title={t('settings.chooseTtsAdapter')}
            theme={theme}
            closeLabel={t('common.done')}
          >
            {ttsChoices.length === 0 ? (
              <Text>{t('settings.noTtsChoices')}</Text>
            ) : (
              <View style={styles.choiceStack}>
                {ttsChoices.map(option => {
                  const selected = ttsAdapter === option;
                  const available = isChoiceAvailable(
                    option,
                    ttsAvailableProviders,
                  );
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.optionCard,
                        {
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.outline + '40',
                          backgroundColor: theme.colors.surfaceVariant,
                          opacity: available ? 1 : 0.48,
                        },
                      ]}
                      onPress={() => {
                        setTtsAdapter(option);
                        setVoice('');
                      }}
                    >
                      <View style={styles.optionTextBlock}>
                        <Text
                          style={[
                            styles.optionTitle,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {option}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {available
                            ? t('settings.chooseTtsAdapter')
                            : t('settings.unavailable')}
                        </Text>
                      </View>
                      {selected ? (
                        <Chip {...paperChipFontScalingProps} compact>
                          {t('common.selected')}
                        </Chip>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </BottomSheet>
        ) : null}

        {voiceDialog ? (
          <BottomSheet
            onClose={() => setVoiceDialog(false)}
            title={t('settings.chooseVoice')}
            theme={theme}
            closeLabel={t('common.done')}
          >
            {voiceLoading ? (
              <View style={styles.centerPad}>
                <ActivityIndicator />
              </View>
            ) : voiceOptions.length === 0 ? (
              <>
                <Text>{t('settings.noVoiceChoices')}</Text>
                <TextInput
                  {...denseTextInputProps}
                  label={t('settings.manualVoice')}
                  value={voice}
                  onChangeText={setVoice}
                  mode="outlined"
                  autoCapitalize="none"
                  style={styles.inputGap}
                />
              </>
            ) : (
              <View style={styles.choiceStack}>
                {voiceOptions.map(option => {
                  const selected = voice === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.optionCard,
                        {
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.outline + '40',
                          backgroundColor: theme.colors.surfaceVariant,
                        },
                      ]}
                      onPress={() => setVoice(option.value)}
                    >
                      <View style={styles.optionTextBlock}>
                        <Text
                          style={[
                            styles.optionTitle,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {option.value}
                        </Text>
                      </View>
                      {selected ? (
                        <Chip {...paperChipFontScalingProps} compact>
                          {t('common.selected')}
                        </Chip>
                      ) : null}
                    </Pressable>
                  );
                })}
                <TextInput
                  {...denseTextInputProps}
                  label={t('settings.manualVoice')}
                  value={voice}
                  onChangeText={setVoice}
                  mode="outlined"
                  autoCapitalize="none"
                />
              </View>
            )}
          </BottomSheet>
        ) : null}

        {sceneDialog ? (
          <View style={styles.sceneOverlay}>
            <Pressable
              style={styles.sceneBackdrop}
              onPress={() => setSceneDialog(false)}
            />
            <View
              style={[
                styles.sceneSheet,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.sceneSheetHeader}>
                <Text
                  style={[
                    styles.sceneSheetTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {t('settings.dialogs.scene')}
                </Text>
                <Button
                  {...paperButtonFontScalingProps}
                  compact
                  onPress={() => setSceneDialog(false)}
                >
                  {t('common.done')}
                </Button>
              </View>

              <ScrollView
                style={styles.sceneGridScroll}
                contentContainerStyle={styles.sceneGrid}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {HDRI_SCENE_NAMES.map(name => {
                  const selected = pickScene === name;
                  const previewUri = resolveHdriPreviewUri(name);
                  const sceneLabel = getSceneLabel(t, name);
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setPickScene(name)}
                      style={[
                        styles.sceneCard,
                        {
                          backgroundColor: theme.colors.surfaceVariant,
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.outline + '40',
                        },
                      ]}
                    >
                      {previewUri ? (
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.scenePreview}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.scenePreviewFallback,
                            { backgroundColor: theme.colors.outline + '20' },
                          ]}
                        />
                      )}
                      <View style={styles.sceneCardFooter}>
                        <Text
                          style={[
                            styles.sceneCardLabel,
                            {
                              color: selected
                                ? theme.colors.primary
                                : theme.colors.onSurface,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {sceneLabel}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : null}
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
  centerPad: {
    padding: 24,
    alignItems: 'center',
  },
  pad: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  inputGap: {
    marginTop: 6,
  },
  rowBtn: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 7, 16, 0.66)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: '38%',
    maxHeight: '78%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetScroll: {
    maxHeight: 560,
  },
  sheetScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sheetHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.75,
  },
  choiceStack: {
    gap: 8,
    paddingBottom: 6,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionTextBlock: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  speedHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  speedHint: {
    fontSize: 11,
    marginBottom: 8,
  },
  speedRail: {
    borderRadius: 18,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  speedMark: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speedMarkLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  speedAdjustRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  speedValuePill: {
    minWidth: 64,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  speedValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sceneOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sceneBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 7, 16, 0.76)',
  },
  sceneSheet: {
    borderRadius: 18,
    paddingTop: 8,
    paddingBottom: 4,
    overflow: 'hidden',
    maxHeight: '72%',
  },
  sceneSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sceneSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sceneGridScroll: {
    maxHeight: 520,
  },
  sceneGrid: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sceneCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  scenePreview: {
    width: '100%',
    aspectRatio: 1.36,
  },
  scenePreviewFallback: {
    width: '100%',
    aspectRatio: 1.36,
  },
  sceneCardFooter: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  sceneCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
});
