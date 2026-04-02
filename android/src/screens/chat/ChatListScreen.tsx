import React from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text, Card, IconButton, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { CharacterConfig } from '@/bridge/types';

interface ChatListScreenProps {
  onSelectChat: (chat: CharacterConfig) => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatListScreen({ onSelectChat, onDeleteChat }: ChatListScreenProps) {
  const theme = useTheme();
  const chatList = useSelector((state: RootState) => state.chat.chatList);

  const handleLongPress = (chat: CharacterConfig) => {
    Alert.alert(chat.characterName, 'Choose an action', [
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteChat(chat.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: CharacterConfig }) => (
    <TouchableOpacity
      onPress={() => onSelectChat(item)}
      onLongPress={() => handleLongPress(item)}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={[styles.characterName, { color: theme.colors.onSurface }]}>
              {item.characterName}
            </Text>
            <Text style={[styles.prompt, { color: theme.colors.onSurface + '99' }]} numberOfLines={2}>
              {item.prompt || 'No prompt set'}
            </Text>
          </View>
          <IconButton icon="chevron-right" iconColor={theme.colors.onSurface + '60'} />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {chatList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            No Conversations Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.onSurface + '70' }]}>
            Start a new conversation from the home screen
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
});
