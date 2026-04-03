import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Text, Card, IconButton, useTheme, FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { CharacterConfig } from '@/bridge/types';
import { bridge } from '@/bridge/WebViewBridge';
import { CHARACTER_MODEL_NAMES } from '@/constants/characterModels';

export default function ChatListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const chatList = useSelector((state: RootState) => state.chat.chatList);
  const selectedCharacterId = useSelector(
    (state: RootState) => state.chat.selectedCharacterId,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelectChat = useCallback(
    (chat: CharacterConfig) => {
      bridge.send({ type: 'chat:select', payload: { chatId: chat.characterId } });
      navigation.navigate('Home' as never);
    },
    [navigation],
  );

  const handleLongPress = useCallback((chat: CharacterConfig) => {
    Alert.alert(chat.characterName, 'Choose an action', [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          bridge.send({ type: 'chat:delete', payload: { chatId: chat.characterId } }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handlePickModel = useCallback((index: number) => {
    setPickerOpen(false);
    bridge.send({ type: 'chat:requestNew', payload: { modelIndex: index } });
    navigation.navigate('Home' as never);
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: CharacterConfig }) => {
      const selected = item.characterId === selectedCharacterId;
      return (
        <TouchableOpacity
          onPress={() => handleSelectChat(item)}
          onLongPress={() => handleLongPress(item)}>
          <Card
            style={[
              styles.card,
              {
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
              },
            ]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardInfo}>
                <Text style={[styles.characterName, { color: theme.colors.onSurface }]}>
                  {item.characterName}
                </Text>
                <Text
                  style={[styles.prompt, { color: theme.colors.onSurface + '99' }]}
                  numberOfLines={2}>
                  {item.prompt || 'No prompt set'}
                </Text>
              </View>
              <IconButton icon="chevron-right" iconColor={theme.colors.onSurface + '60'} />
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handleLongPress, handleSelectChat, selectedCharacterId, theme.colors],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {chatList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            No Conversations Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.onSurface + '70' }]}>
            Tap + to duplicate a character and pick a model
          </Text>
        </View>
      ) : (
        <FlatList
          data={chatList}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setPickerOpen(true)}
        color={theme.colors.onPrimary}
      />

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              New conversation — pick model
            </Text>
            <View style={styles.grid}>
              {CHARACTER_MODEL_NAMES.map((name, index) => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.gridItem,
                    { borderColor: theme.colors.outline, backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  onPress={() => handlePickModel(index)}>
                  <Text
                    style={[styles.gridLabel, { color: theme.colors.onSurface }]}
                    numberOfLines={2}>
                    {name.replace('-default', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalClose}>
              <Text style={{ color: theme.colors.primary }}>Cancel</Text>
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
  },
  cardInfo: {
    flex: 1,
  },
  characterName: {
    fontSize: 16,
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
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
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
