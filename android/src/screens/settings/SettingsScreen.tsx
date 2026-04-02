import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
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
} from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setLanguage, setTheme, setServerUrl } from '@/store/appSlice';
import { logout } from '@/store/authSlice';

interface SettingsScreenProps {
  onLogout: () => void;
}

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const language = useSelector((state: RootState) => state.app.language);
  const appTheme = useSelector((state: RootState) => state.app.theme);
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [editingUrl, setEditingUrl] = useState(serverUrl);

  const handleSaveUrl = () => {
    const trimmed = editingUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setServerUrl(trimmed));
      setShowUrlDialog(false);
    } else {
      Alert.alert('Invalid URL', 'Server URL must to start with http:// or https://');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
        <List.Subheader style={{ color: theme.colors.primary }}>Appearance</List.Subheader>
        <List.Item
          title="Dark Mode"
          left={props => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => (
            <Switch
              value={appTheme === 'dark'}
              onValueChange={(v: boolean) => {
                dispatch(setTheme(v ? 'dark' : 'light'));
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
                dispatch(setLanguage(v ? 'zh' : 'en'));
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
          title="Server URL"
          description={serverUrl}
          left={props => <List.Icon {...props} icon="server" />}
          onPress={() => {
            setEditingUrl(serverUrl);
            setShowUrlDialog(true);
          }}
          titleStyle={{ color: theme.colors.onSurface }}
          descriptionStyle={{ color: theme.colors.onSurface + '70' }}
        />
      </List.Section>

      <Divider />

      <View style={styles.footer}>
        <Text style={[styles.version, { color: theme.colors.onSurface + '50' }]}>
          DLP3D Android v0.1.0
        </Text>
        <Button
          mode="outlined"
          onPress={onLogout}
          textColor={theme.colors.error}
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          icon="logout">
          Sign Out
        </Button>
      </View>

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
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
