import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { patchDashboardCharacter } from '@/services/characterSettingsApi';
import { bridge } from '@/bridge/WebViewBridge';
import { useTranslation } from 'react-i18next';

type PromptEditorRoute = RouteProp<
  {
    CharacterPromptEditor: {
      characterId: string;
      characterName: string;
      initialPrompt: string;
      readOnly: boolean;
    };
  },
  'CharacterPromptEditor'
>;

export function PromptEditorScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<PromptEditorRoute>();
  const insets = useSafeAreaInsets();
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const { characterId, initialPrompt, readOnly } = route.params;
  const [draftPrompt, setDraftPrompt] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const allowRemoveRef = useRef(false);
  const savedPromptRef = useRef(initialPrompt);
  const isDirty = useMemo(
    () => draftPrompt !== savedPromptRef.current,
    [draftPrompt],
  );

  const persistPrompt = useCallback(async () => {
    setSaving(true);
    try {
      await patchDashboardCharacter(serverUrl, characterId, {
        prompt: draftPrompt,
      });
      bridge.send({
        type: 'config:update',
        payload: { source: 'native-settings' },
      });
      savedPromptRef.current = draftPrompt;
      return true;
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error
          ? error.message
          : t('settings.alerts.requestFailed'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [characterId, draftPrompt, serverUrl, t]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (allowRemoveRef.current || !isDirty || saving || readOnly) {
        return;
      }

      event.preventDefault();
      const pendingAction = event.data.action;

      Alert.alert(
        t('settings.promptEditor.unsavedTitle'),
        t('settings.promptEditor.unsavedMessage'),
        [
          {
            text: t('settings.promptEditor.continueEditing'),
            style: 'cancel',
          },
          {
            text: t('settings.promptEditor.discardAndExit'),
            style: 'destructive',
            onPress: () => {
              allowRemoveRef.current = true;
              navigation.dispatch(pendingAction);
            },
          },
          {
            text: t('settings.promptEditor.saveAndExit'),
            onPress: () => {
              void (async () => {
                const saved = await persistPrompt();
                if (saved) {
                  allowRemoveRef.current = true;
                  navigation.dispatch(pendingAction);
                }
              })();
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [isDirty, navigation, persistPrompt, saving, t]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View
          style={[
            styles.editorShell,
            {
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          <NativeTextInput
            value={draftPrompt}
            onChangeText={setDraftPrompt}
            multiline
            autoFocus={!readOnly}
            editable={!readOnly}
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="none"
            scrollEnabled
            placeholder={
              readOnly ? '' : t('settings.promptEditor.placeholder')
            }
            placeholderTextColor={theme.colors.onSurfaceVariant + '88'}
            selectionColor={theme.colors.primary}
            keyboardAppearance={theme.dark ? 'dark' : 'light'}
            style={[
              styles.editor,
              {
                color: theme.colors.onSurface,
              },
            ]}
          />
          {saving ? (
            <View
              style={[
                styles.savingOverlay,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <ActivityIndicator size="small" />
            </View>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  editorShell: {
    flex: 1,
    position: 'relative',
  },
  editor: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    fontSize: 17,
    lineHeight: 28,
    textAlignVertical: 'top',
  },
  savingOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
