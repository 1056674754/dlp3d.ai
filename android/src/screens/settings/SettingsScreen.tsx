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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
  fetchReactionChoices,
  fetchClassificationChoices,
  fetchMemoryChoices,
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

function getPromptPreview(
  prompt: string | undefined,
  fallback: string,
): string {
  const normalized = (prompt ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : fallback;
}

interface VoiceOption {
  value: string;
  label: string;
}

function getVoiceLabel(voiceOptions: VoiceOption[], voiceId: string): string {
  const matched = voiceOptions.find(option => option.value === voiceId);
  return matched?.label || voiceId;
}

type LlmFeature = 'conversation' | 'reaction' | 'memory' | 'classification';

const LLM_FEATURE_META: Record<
  LlmFeature,
  {
    titleKey:
      | 'settings.llmConversation'
      | 'settings.llmReaction'
      | 'settings.llmMemory'
      | 'settings.llmClassification';
    dialogTitleKey:
      | 'settings.dialogs.conversationModel'
      | 'settings.dialogs.reactionModel'
      | 'settings.dialogs.memoryModel'
      | 'settings.dialogs.classificationModel';
    emptyChoicesKey:
      | 'settings.dialogs.noConversationChoices'
      | 'settings.dialogs.noReactionChoices'
      | 'settings.dialogs.noMemoryChoices'
      | 'settings.dialogs.noClassificationChoices';
  }
> = {
  conversation: {
    titleKey: 'settings.llmConversation',
    dialogTitleKey: 'settings.dialogs.conversationModel',
    emptyChoicesKey: 'settings.dialogs.noConversationChoices',
  },
  reaction: {
    titleKey: 'settings.llmReaction',
    dialogTitleKey: 'settings.dialogs.reactionModel',
    emptyChoicesKey: 'settings.dialogs.noReactionChoices',
  },
  memory: {
    titleKey: 'settings.llmMemory',
    dialogTitleKey: 'settings.dialogs.memoryModel',
    emptyChoicesKey: 'settings.dialogs.noMemoryChoices',
  },
  classification: {
    titleKey: 'settings.llmClassification',
    dialogTitleKey: 'settings.dialogs.classificationModel',
    emptyChoicesKey: 'settings.dialogs.noClassificationChoices',
  },
};

function getLlmAdapterValue(
  cfg: CharacterConfigDto,
  feature: LlmFeature,
): string {
  switch (feature) {
    case 'conversation':
      return cfg.conversation_adapter || '';
    case 'reaction':
      return cfg.reaction_adapter || '';
    case 'memory':
      return cfg.memory_adapter || '';
    case 'classification':
      return cfg.classification_adapter || '';
  }
}

function getLlmOverrideValue(
  cfg: CharacterConfigDto,
  feature: LlmFeature,
): string {
  switch (feature) {
    case 'conversation':
      return cfg.conversation_model_override || '';
    case 'reaction':
      return cfg.reaction_model_override || '';
    case 'memory':
      return cfg.memory_model_override || '';
    case 'classification':
      return cfg.classification_model_override || '';
  }
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
  onCancel: () => void;
  onDone: () => void;
  title: string;
  theme: MD3Theme;
  cancelLabel: string;
  doneLabel: string;
  doneDisabled?: boolean;
  doneLoading?: boolean;
  children: React.ReactNode;
}

function BottomSheet({
  onCancel,
  onDone,
  title,
  theme,
  cancelLabel,
  doneLabel,
  doneDisabled,
  doneLoading,
  children,
}: BottomSheetProps) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel} />
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sheetHeader}>
          <Button {...paperButtonFontScalingProps} compact onPress={onCancel}>
            {cancelLabel}
          </Button>
          <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          <Button
            {...paperButtonFontScalingProps}
            compact
            onPress={onDone}
            disabled={doneDisabled}
            loading={doneLoading}
          >
            {doneLabel}
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
  const navigation = useNavigation<any>();
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
  const [reactionChoices, setReactionChoices] = useState<string[]>([]);
  const [memoryChoices, setMemoryChoices] = useState<string[]>([]);
  const [classificationChoices, setClassificationChoices] = useState<string[]>(
    [],
  );
  const [asrChoices, setAsrChoices] = useState<string[]>([]);
  const [ttsChoices, setTtsChoices] = useState<string[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const [nameDialog, setNameDialog] = useState(false);
  const [pickName, setPickName] = useState('');
  const [llmDialogFeature, setLlmDialogFeature] = useState<LlmFeature | null>(
    null,
  );
  const [pickLlmAdapter, setPickLlmAdapter] = useState('');
  const [pickLlmOverride, setPickLlmOverride] = useState('');
  const [asrDialog, setAsrDialog] = useState(false);
  const [pickAsr, setPickAsr] = useState('');
  const [ttsDialog, setTtsDialog] = useState(false);

  const [ttsAdapter, setTtsAdapter] = useState('');
  const [voice, setVoice] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState('1');
  const [wakeWord, setWakeWord] = useState('');

  const [sceneDialog, setSceneDialog] = useState(false);
  const [pickScene, setPickScene] = useState('');
  const loadedCharacterId = config?.character_id ?? null;

  const applyConfig = useCallback((cfg: CharacterConfigDto) => {
    setConfig(cfg);
    setPickName(cfg.character_name || '');
    setPickAsr(cfg.asr_adapter || '');
    setTtsAdapter(cfg.tts_adapter || '');
    setVoice(cfg.voice || '');
    setVoiceSpeed(String(cfg.voice_speed ?? 1));
    setWakeWord(cfg.wake_word || '');
    setPickScene(normalizeHdriSceneName(cfg.scene_name));
  }, []);

  const notifyWeb = useCallback(() => {
    bridge.send({
      type: 'config:update',
      payload: { source: 'native-settings' },
    });
  }, []);

  const loadCharacter = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!userInfo.id || !activeCharacterId) {
      setConfig(null);
      setWakeWord('');
      setLlmAvailableProviders([]);
      setAsrAvailableProviders([]);
      setTtsAvailableProviders([]);
      setConversationChoices([]);
      setReactionChoices([]);
      setMemoryChoices([]);
      setClassificationChoices([]);
      setAsrChoices([]);
      setTtsChoices([]);
      setVoiceOptions([]);
      setRefreshing(false);
      return;
    }

    const shouldBlockScreen =
      !background && loadedCharacterId !== activeCharacterId;

    if (shouldBlockScreen) {
      setLoading(true);
    } else if (background) {
      setRefreshing(true);
    }

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
        conversationAdapterChoices,
        reactionAdapterChoices,
        memoryAdapterChoices,
        classificationAdapterChoices,
        speechChoices,
        speechSynthesisChoices,
      ] = await Promise.all([
        loadDashboardConfig(),
        fetchAvailableLlm(serverUrl, userInfo.id),
        fetchAvailableAsr(serverUrl, userInfo.id),
        fetchAvailableTts(serverUrl, userInfo.id),
        fetchConversationChoices(serverUrl),
        fetchReactionChoices(serverUrl),
        fetchMemoryChoices(serverUrl),
        fetchClassificationChoices(serverUrl),
        fetchAsrChoices(serverUrl),
        fetchTtsChoices(serverUrl),
      ]);

      applyConfig(cfg);
      setLlmAvailableProviders(llm.options?.length ? llm.options : []);
      setAsrAvailableProviders(asr.options?.length ? asr.options : []);
      setTtsAvailableProviders(tts.options?.length ? tts.options : []);
      setConversationChoices(
        mergeChoicesWithCurrent(
          conversationAdapterChoices.choices?.length
            ? conversationAdapterChoices.choices
            : [],
          cfg.conversation_adapter,
        ),
      );
      setReactionChoices(
        mergeChoicesWithCurrent(
          reactionAdapterChoices.choices?.length
            ? reactionAdapterChoices.choices
            : [],
          cfg.reaction_adapter,
        ),
      );
      setMemoryChoices(
        mergeChoicesWithCurrent(
          memoryAdapterChoices.choices?.length
            ? memoryAdapterChoices.choices
            : [],
          cfg.memory_adapter,
        ),
      );
      setClassificationChoices(
        mergeChoicesWithCurrent(
          classificationAdapterChoices.choices?.length
            ? classificationAdapterChoices.choices
            : [],
          cfg.classification_adapter,
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
      if (shouldBlockScreen) {
        setConfig(null);
      }
    } finally {
      if (shouldBlockScreen) {
        setLoading(false);
      }
      if (background) {
        setRefreshing(false);
      }
    }
  }, [
    activeCharacterId,
    applyConfig,
    loadedCharacterId,
    serverUrl,
    t,
    userInfo.email,
    userInfo.id,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadCharacter();
    }, [loadCharacter]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        dispatch(setSettingsCharacterId(null));
      };
    }, [dispatch]),
  );

  const readOnly = config?.read_only === true;
  const promptPreview = getPromptPreview(
    config?.prompt,
    t('chatList.noPromptSet'),
  );

  const openNameDialog = useCallback(() => {
    if (!config) {
      return;
    }
    setPickName(config.character_name || '');
    setNameDialog(true);
  }, [config]);

  const openLlmDialog = useCallback((feature: LlmFeature) => {
    if (!config) {
      return;
    }
    setPickLlmAdapter(getLlmAdapterValue(config, feature));
    setPickLlmOverride(getLlmOverrideValue(config, feature));
    setLlmDialogFeature(feature);
  }, [config]);

  const openAsrDialog = useCallback(() => {
    if (!config) {
      return;
    }
    setPickAsr(config.asr_adapter || '');
    setAsrDialog(true);
  }, [config]);

  const openTtsDialog = useCallback(() => {
    if (!config) {
      return;
    }
    setTtsAdapter(config.tts_adapter || '');
    setVoice(config.voice || '');
    setVoiceSpeed(String(config.voice_speed ?? 1));
    setTtsDialog(true);
  }, [config]);

  const openSceneDialog = useCallback(() => {
    if (!config) {
      return;
    }
    setPickScene(normalizeHdriSceneName(config.scene_name));
    setSceneDialog(true);
  }, [config]);

  const openPromptEditor = useCallback(() => {
    if (!config) {
      return;
    }
    navigation.navigate(
      'CharacterPromptEditor' as never,
      {
        characterId: config.character_id,
        characterName: config.character_name,
        initialPrompt: config.prompt || '',
        readOnly,
      } as never,
    );
  }, [config, navigation, readOnly]);

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

  const runSave = async (
    key: string,
    fn: () => Promise<unknown>,
    options?: { onSuccess?: () => void; silent?: boolean },
  ) => {
    if (!userInfo.id || !activeCharacterId) {
      return;
    }
    setSaving(key);
    try {
      await fn();
      notifyWeb();
      await loadCharacter({ background: true });
      options?.onSuccess?.();
      if (!options?.silent) {
        Alert.alert(t('common.saved'));
      }
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

  const handleSaveName = () =>
    runSave(
      'name',
      () =>
        patchDashboardCharacter(serverUrl, activeCharacterId!, {
          character_name: pickName.trim(),
        }),
      {
        silent: true,
        onSuccess: () => setNameDialog(false),
      },
    );

  const handleSaveLlm = () =>
    llmDialogFeature
      ? runSave(
          `llm-${llmDialogFeature}`,
          () => {
            switch (llmDialogFeature) {
              case 'conversation':
                return patchDashboardCharacter(serverUrl, activeCharacterId!, {
                  conversation_adapter: pickLlmAdapter,
                  conversation_model_override: pickLlmOverride,
                });
              case 'reaction':
                return patchDashboardCharacter(serverUrl, activeCharacterId!, {
                  reaction_adapter: pickLlmAdapter,
                  reaction_model_override: pickLlmOverride,
                });
              case 'memory':
                return patchDashboardCharacter(serverUrl, activeCharacterId!, {
                  memory_adapter: pickLlmAdapter,
                  memory_model_override: pickLlmOverride,
                });
              case 'classification':
                return patchDashboardCharacter(serverUrl, activeCharacterId!, {
                  classification_adapter: pickLlmAdapter,
                  classification_model_override: pickLlmOverride,
                });
            }
          },
          {
            silent: true,
            onSuccess: () => setLlmDialogFeature(null),
          },
        )
      : Promise.resolve();

  const handleSaveTts = () => {
    const parsedSpeed = clampSpeed(parseFloat(voiceSpeed));
    return runSave(
      'tts',
      () =>
        patchDashboardCharacter(serverUrl, activeCharacterId!, {
          tts_adapter: ttsAdapter,
          voice,
          voice_speed: Number.isFinite(parsedSpeed) ? parsedSpeed : 1,
          wake_word: wakeWord.trim(),
        }),
      {
        silent: true,
        onSuccess: () => setTtsDialog(false),
      },
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
    runSave(
      'asr',
      () =>
        patchDashboardCharacter(serverUrl, activeCharacterId!, {
          asr_adapter: pickAsr,
        }),
      {
        silent: true,
        onSuccess: () => setAsrDialog(false),
      },
    );

  const handleSaveScene = () =>
    runSave(
      'scene',
      () =>
        patchDashboardCharacter(serverUrl, activeCharacterId!, {
          scene_name: pickScene,
        }),
      {
        silent: true,
        onSuccess: () => setSceneDialog(false),
      },
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

  const activeLlmMeta = llmDialogFeature
    ? LLM_FEATURE_META[llmDialogFeature]
    : null;

  const activeLlmChoices =
    llmDialogFeature === 'conversation'
      ? conversationChoices
      : llmDialogFeature === 'reaction'
        ? reactionChoices
        : llmDialogFeature === 'memory'
          ? memoryChoices
          : llmDialogFeature === 'classification'
            ? classificationChoices
            : [];

  const getLlmDescription = (feature: LlmFeature) => {
    if (!config) {
      return '—';
    }
    const adapter = getLlmAdapterValue(config, feature);
    const override = getLlmOverrideValue(config, feature);
    return `${adapter || '—'}${override ? ` · ${override}` : ''}`;
  };

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
                onPress={() => !readOnly && openNameDialog()}
                disabled={readOnly}
                right={props =>
                  refreshing ? (
                    <ActivityIndicator
                      size="small"
                      color={props.color}
                      style={props.style}
                    />
                  ) : null
                }
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
                description={getLlmDescription('conversation')}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="brain" />}
                onPress={() => !readOnly && openLlmDialog('conversation')}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.llmReaction')}
                description={getLlmDescription('reaction')}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="brain" />}
                onPress={() => !readOnly && openLlmDialog('reaction')}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.llmMemory')}
                description={getLlmDescription('memory')}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="brain" />}
                onPress={() => !readOnly && openLlmDialog('memory')}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.llmClassification')}
                description={getLlmDescription('classification')}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="brain" />}
                onPress={() => !readOnly && openLlmDialog('classification')}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.asrRecognition')}
                description={config.asr_adapter || '—'}
                descriptionNumberOfLines={1}
                left={props => (
                  <List.Icon {...props} icon="microphone-outline" />
                )}
                onPress={() => !readOnly && openAsrDialog()}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.tts')}
                description={`${config.tts_adapter || '—'} · ${
                  config.voice
                    ? getVoiceLabel(voiceOptions, config.voice)
                    : '—'
                } · ${(config.voice_speed ?? 1).toFixed(1)}x`}
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="speaker-multiple" />}
                onPress={() => !readOnly && openTtsDialog()}
                disabled={readOnly}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.prompt')}
                description={promptPreview}
                descriptionNumberOfLines={3}
                left={props => <List.Icon {...props} icon="text-box-outline" />}
                onPress={openPromptEditor}
              />

              <List.Item
                {...compactListItemProps}
                title={t('settings.sceneHdri')}
                description={
                  config.scene_name ? getSceneLabel(t, config.scene_name) : '—'
                }
                descriptionNumberOfLines={1}
                left={props => <List.Icon {...props} icon="image-filter-hdr" />}
                onPress={() => !readOnly && openSceneDialog()}
                disabled={readOnly}
              />
            </List.Section>
          </>
        ) : null}
      </ScrollView>

      <Portal>
        {nameDialog ? (
          <BottomSheet
            onCancel={() => setNameDialog(false)}
            onDone={() => void handleSaveName()}
            title={t('settings.characterName')}
            theme={theme}
            cancelLabel={t('common.cancel')}
            doneLabel={t('common.done')}
            doneDisabled={saving !== null || pickName.trim().length === 0}
            doneLoading={saving === 'name'}
          >
            <TextInput
              {...denseTextInputProps}
              label={t('settings.characterName')}
              value={pickName}
              onChangeText={setPickName}
              mode="outlined"
              autoFocus
            />
          </BottomSheet>
        ) : null}

        {llmDialogFeature && activeLlmMeta ? (
          <BottomSheet
            onCancel={() => setLlmDialogFeature(null)}
            onDone={() => void handleSaveLlm()}
            title={t(activeLlmMeta.dialogTitleKey)}
            theme={theme}
            cancelLabel={t('common.cancel')}
            doneLabel={t('common.done')}
            doneDisabled={saving !== null || pickLlmAdapter.trim().length === 0}
            doneLoading={saving === `llm-${llmDialogFeature}`}
          >
            {activeLlmChoices.length === 0 ? (
              <Text>{t(activeLlmMeta.emptyChoicesKey)}</Text>
            ) : (
              renderAdapterCards(
                activeLlmChoices,
                pickLlmAdapter,
                llmAvailableProviders,
                setPickLlmAdapter,
                t(activeLlmMeta.dialogTitleKey),
              )
            )}
            <TextInput
              {...denseTextInputProps}
              label={t('settings.dialogs.llmAdapter')}
              value={pickLlmAdapter}
              onChangeText={setPickLlmAdapter}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inputGap}
            />
            <TextInput
              {...denseTextInputProps}
              label={t('settings.dialogs.modelOverrideOptional')}
              value={pickLlmOverride}
              onChangeText={setPickLlmOverride}
              mode="outlined"
              style={styles.inputGap}
            />
            <Text style={styles.sheetHint}>
              {t('settings.dialogs.llmAdapterHint')}
            </Text>
          </BottomSheet>
        ) : null}

        {asrDialog ? (
          <BottomSheet
            onCancel={() => setAsrDialog(false)}
            onDone={() => void handleSaveAsr()}
            title={t('settings.dialogs.speechRecognition')}
            theme={theme}
            cancelLabel={t('common.cancel')}
            doneLabel={t('common.done')}
            doneDisabled={saving !== null || pickAsr.trim().length === 0}
            doneLoading={saving === 'asr'}
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
            onCancel={() => {
              if (config) {
                setTtsAdapter(config.tts_adapter || '');
                setVoice(config.voice || '');
                setVoiceSpeed(String(config.voice_speed ?? 1));
                setWakeWord(config.wake_word || '');
              }
              setTtsDialog(false);
            }}
            onDone={() => void handleSaveTts()}
            title={t('settings.tts')}
            theme={theme}
            cancelLabel={t('common.cancel')}
            doneLabel={t('common.done')}
            doneDisabled={saving !== null || ttsAdapter.trim().length === 0}
            doneLoading={saving === 'tts'}
          >
            <Text style={styles.sheetGroupTitle}>{t('settings.ttsAdapter')}</Text>
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

            <Text style={styles.sheetGroupTitle}>{t('settings.voice')}</Text>
            {voiceLoading ? (
              <View style={styles.centerPad}>
                <ActivityIndicator />
              </View>
            ) : voiceOptions.length === 0 ? (
              <Text>{t('settings.noVoiceChoices')}</Text>
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
              </View>
            )}
            <TextInput
              {...denseTextInputProps}
              label={t('settings.manualVoice')}
              value={voice}
              onChangeText={setVoice}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inputGap}
            />
            <TextInput
              {...denseTextInputProps}
              label={t('settings.characterWakeWord')}
              value={wakeWord}
              onChangeText={setWakeWord}
              mode="outlined"
              autoCapitalize="none"
              style={styles.inputGap}
            />
            <Text style={styles.sheetHint}>{t('settings.characterWakeWordHint')}</Text>

            <Text style={styles.sheetGroupTitle}>
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
              >
                {t('settings.faster')}
              </Button>
            </View>
          </BottomSheet>
        ) : null}

        {sceneDialog ? (
          <BottomSheet
            onCancel={() => setSceneDialog(false)}
            onDone={() => void handleSaveScene()}
            title={t('settings.dialogs.scene')}
            theme={theme}
            cancelLabel={t('common.cancel')}
            doneLabel={t('common.done')}
            doneDisabled={saving !== null || pickScene.trim().length === 0}
            doneLoading={saving === 'scene'}
          >
            <View style={styles.sceneGrid}>
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
            </View>
          </BottomSheet>
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
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
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
  sheetGroupTitle: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
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
  sceneGrid: {
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
