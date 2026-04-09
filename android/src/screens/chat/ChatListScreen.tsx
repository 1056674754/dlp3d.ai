import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  useTheme,
  FAB,
  Button,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '@/store';
import type { CharacterConfig } from '@/bridge/types';
import { bridge } from '@/bridge/WebViewBridge';
import { CHARACTER_MODEL_NAMES } from '@/constants/characterModels';
import {
  paperButtonFontScalingProps,
  paperChipFontScalingProps,
  paperFabFontScalingProps,
} from '@/theme/fontScaling';
import {
  markChatUsed,
  setIsCharacterLoading,
  setSelectedCharacterId,
  setSelectedChat,
  setSettingsCharacterId,
} from '@/store/chatSlice';
import { resolveCharacterPreviewUri } from '@/utils/characterPreview';

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function ChatListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const rawChatList = useSelector((state: RootState) => state.chat.chatList);
  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );
  const rawLastUsedAtByCharacterId = useSelector(
    (state: RootState) => state.chat.lastUsedAtByCharacterId,
  );
  const chatList = useMemo(
    () => (Array.isArray(rawChatList) ? rawChatList : []),
    [rawChatList],
  );
  const lastUsedAtByCharacterId = useMemo(
    () =>
      rawLastUsedAtByCharacterId &&
      typeof rawLastUsedAtByCharacterId === 'object'
        ? rawLastUsedAtByCharacterId
        : {},
    [rawLastUsedAtByCharacterId],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(true);

  const handleSelectChat = useCallback(
    (chat: CharacterConfig) => {
      dispatch(setSettingsCharacterId(null));
      dispatch(setSelectedChat(chat));
      dispatch(setSelectedCharacterId(chat.characterId));
      dispatch(markChatUsed({ characterId: chat.characterId }));
      dispatch(setIsCharacterLoading(true));
      bridge.send({
        type: 'chat:select',
        payload: { chatId: chat.characterId },
      });

      const unsub = bridge.on('character:changed', () => {
        unsub();
        dispatch(setIsCharacterLoading(false));
        navigation.navigate('Home' as never);
      });
      // Safety timeout: navigate regardless after 800ms
      setTimeout(() => {
        unsub();
        dispatch(setIsCharacterLoading(false));
        navigation.navigate('Home' as never);
      }, 800);
    },
    [navigation, dispatch],
  );

  const handleManageChat = useCallback(
    (chat: CharacterConfig) => {
      dispatch(setSettingsCharacterId(chat.characterId));
      dispatch(setSelectedChat(chat));
      navigation.navigate('CharacterSettings' as never);
    },
    [dispatch, navigation],
  );

  const handleLongPress = useCallback(
    (chat: CharacterConfig) => {
      if (chat.readOnly) {
        Alert.alert(chat.characterName, t('chatList.readOnlyDeleteBlocked'), [
          {
            text: chat.readOnly
              ? t('chatList.viewCharacter')
              : t('chatList.configureCharacter'),
            onPress: () => handleManageChat(chat),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
        return;
      }

      Alert.alert(chat.characterName, t('chatList.chooseAction'), [
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () =>
            bridge.send({
              type: 'chat:delete',
              payload: { chatId: chat.characterId },
            }),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [handleManageChat, t],
  );

  const handlePickModel = useCallback(
    (index: number) => {
      setPickerOpen(false);
      dispatch(setSettingsCharacterId(null));
      bridge.send({ type: 'chat:requestNew', payload: { modelIndex: index } });
      navigation.navigate('Home' as never);
    },
    [dispatch, navigation],
  );

  const modelPreviewUris = useMemo(
    () => CHARACTER_MODEL_NAMES.map(name => resolveCharacterPreviewUri(name)),
    [],
  );

  const visibleChats = useMemo(() => {
    const sorted = [...chatList].sort((left, right) => {
      const recentDelta =
        (lastUsedAtByCharacterId[right.characterId] ?? 0) -
        (lastUsedAtByCharacterId[left.characterId] ?? 0);
      if (recentDelta !== 0) {
        return recentDelta;
      }

      const createdDelta =
        parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
      if (createdDelta !== 0) {
        return createdDelta;
      }

      return left.characterName.localeCompare(right.characterName);
    });

    return sorted.filter(chat => {
      if (showRecentOnly && !lastUsedAtByCharacterId[chat.characterId]) {
        return false;
      }
      if (showOnlyMine && chat.readOnly === true) {
        return false;
      }
      return true;
    });
  }, [chatList, lastUsedAtByCharacterId, showOnlyMine, showRecentOnly]);

  const emptyCopy =
    chatList.length === 0
      ? {
          title: t('chatList.emptyTitle'),
          subtitle: t('chatList.emptySubtitle'),
        }
      : {
          title: t('chatList.filteredEmptyTitle'),
          subtitle: t('chatList.filteredEmptySubtitle'),
        };

  const renderItem = useCallback(
    ({ item }: { item: CharacterConfig }) => {
      const selected = item.characterId === selectedCharacterId;
      const imgUri = resolveCharacterPreviewUri(item.avatarModelName);
      const manageLabel = item.readOnly
        ? t('chatList.viewCharacter')
        : t('chatList.configureCharacter');

      return (
        <Card
          style={[
            styles.card,
            {
              backgroundColor: selected
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <Pressable
              style={styles.primaryAction}
              onPress={() => handleSelectChat(item)}
              onLongPress={() => handleLongPress(item)}
            >
              {imgUri ? (
                <Image
                  source={{ uri: imgUri }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.colors.outline + '30' },
                  ]}
                >
                  <IconButton
                    icon="account"
                    size={24}
                    iconColor={theme.colors.onSurface + '60'}
                  />
                </View>
              )}
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.characterName,
                      { color: theme.colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {item.characterName}
                  </Text>
                  {item.readOnly ? (
                    <View
                      style={[
                        styles.readOnlyBadge,
                        { backgroundColor: theme.colors.outline + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.readOnlyBadgeText,
                          { color: theme.colors.onSurface + 'B3' },
                        ]}
                      >
                        {t('chatList.readOnlyBadge')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.prompt,
                    { color: theme.colors.onSurface + '99' },
                  ]}
                  numberOfLines={2}
                >
                  {item.prompt || t('chatList.noPromptSet')}
                </Text>
              </View>
            </Pressable>

            <View style={styles.cardActions}>
              <Button
                {...paperButtonFontScalingProps}
                mode="text"
                compact
                icon={item.readOnly ? 'eye-outline' : 'cog-outline'}
                onPress={() => handleManageChat(item)}
                contentStyle={styles.manageButtonContent}
                labelStyle={[
                  styles.manageButtonLabel,
                  { color: theme.colors.primary },
                ]}
              >
                {manageLabel}
              </Button>
            </View>
          </Card.Content>
        </Card>
      );
    },
    [
      handleLongPress,
      handleManageChat,
      handleSelectChat,
      selectedCharacterId,
      t,
      theme.colors,
    ],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.filters}>
        <Chip
          {...paperChipFontScalingProps}
          compact
          icon="history"
          selected={showRecentOnly}
          onPress={() => setShowRecentOnly(current => !current)}
          style={styles.filterChip}
          textStyle={styles.filterChipLabel}
        >
          {t('chatList.recentlyUsed')}
        </Chip>
        <Chip
          {...paperChipFontScalingProps}
          compact
          icon="account"
          selected={showOnlyMine}
          onPress={() => setShowOnlyMine(current => !current)}
          style={styles.filterChip}
          textStyle={styles.filterChipLabel}
        >
          {t('chatList.onlyMine')}
        </Chip>
      </View>

      {visibleChats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            {emptyCopy.title}
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: theme.colors.onSurface + '70' },
            ]}
          >
            {emptyCopy.subtitle}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleChats}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB
        {...paperFabFontScalingProps}
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setPickerOpen(true)}
        color={theme.colors.onPrimary}
      />

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.surface },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <Text
              style={[styles.modalTitle, { color: theme.colors.onSurface }]}
            >
              {t('chatList.newConversationTitle')}
            </Text>
            <View style={styles.grid}>
              {CHARACTER_MODEL_NAMES.map((name, index) => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.gridItem,
                    {
                      borderColor: theme.colors.outline,
                      backgroundColor: theme.colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => handlePickModel(index)}
                >
                  {modelPreviewUris[index] ? (
                    <Image
                      source={{ uri: modelPreviewUris[index]! }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.gridLabelContainer}>
                    <Text
                      style={[
                        styles.gridLabel,
                        { color: theme.colors.onSurface },
                      ]}
                      numberOfLines={1}
                    >
                      {name.replace('-default', '')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setPickerOpen(false)}
              style={styles.modalClose}
            >
              <Text style={{ color: theme.colors.primary }}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  filterChip: {
    borderRadius: 13,
    minHeight: 26,
  },
  filterChipLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 88,
  },
  card: {
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  manageButtonContent: {
    flexDirection: 'row-reverse',
  },
  manageButtonLabel: {
    fontSize: 13,
    marginVertical: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  characterName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  readOnlyBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  readOnlyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  prompt: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '31%',
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    flex: 1,
  },
  gridLabelContainer: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  modalClose: {
    marginTop: 12,
    alignItems: 'center',
  },
});
