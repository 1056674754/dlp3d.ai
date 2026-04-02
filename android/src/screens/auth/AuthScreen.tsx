import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setServerUrl } from '@/store/appSlice';
import { setAuthState, setIsLogin } from '@/store/authSlice';
import { authenticateUser, registerUser } from '@/services/api';
import {
  getSavedAccounts,
  saveAccount,
  removeAccount,
  type SavedAccount,
} from '@/services/accountStorage';

interface AuthScreenProps {
  onLogin: (userId: string, email: string) => void;
  onRegister: (userId: string, email: string) => void;
  isLoading?: boolean;
}

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const [showServerInput, setShowServerInput] = useState(false);
  const [editingUrl, setEditingUrl] = useState(serverUrl);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const accounts = await getSavedAccounts();
    setSavedAccounts(accounts.sort((a, b) => b.lastUsed - a.lastUsed));
  };

  const handleSelectAccount = useCallback(
    (account: SavedAccount) => {
      if (account.serverUrl !== serverUrl) {
        dispatch(setServerUrl(account.serverUrl));
      }
      setEmail(account.email);
      setPassword(account.password);
      setUsername('');
      setIsRegister(false);
    },
    [dispatch, serverUrl],
  );

  const handleDeleteAccount = useCallback(
    (account: SavedAccount) => {
      Alert.alert('Remove Account', `Remove saved account ${account.email}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeAccount(account.serverUrl, account.email);
            await loadAccounts();
          },
        },
      ]);
    },
    [],
  );

  const handleSaveUrl = () => {
    const trimmed = editingUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      dispatch(setServerUrl(trimmed));
      setShowServerInput(false);
    } else {
      Alert.alert('Invalid URL', 'Server URL must start with http:// or https://');
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in email and password');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    const currentUrl = serverUrl;
    setLoading(true);

    try {
      if (isRegister) {
        if (!username) {
          Alert.alert('Error', 'Please enter a username');
          setLoading(false);
          return;
        }
        const response = await registerUser(currentUrl, email, password);
        if (response.auth_code === 200) {
          Alert.alert('Success', 'Registration successful! You can now log in.');
          setIsRegister(false);
        } else {
          Alert.alert('Registration Failed', response.auth_msg);
        }
      } else {
        const response = await authenticateUser(currentUrl, email, password);
        if (response.auth_code === 200) {
          dispatch(
            setAuthState({
              isLogin: true,
              userInfo: { username: email, email, id: response.user_id },
            }),
          );
          await saveAccount({
            serverUrl: currentUrl,
            email,
            password,
            userId: response.user_id,
            lastUsed: Date.now(),
          });
          await loadAccounts();
          onLogin(response.user_id, email);
        } else {
          Alert.alert('Login Failed', response.auth_msg);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const textColor = theme.colors.onSurface;
  const mutedColor = textColor + '60';
  const faintColor = textColor + '40';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.colors.primary }]}>DLP3D</Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </Text>

        <View style={styles.form}>
          {savedAccounts.length > 0 && !isRegister && (
            <View style={styles.accountsSection}>
              <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 8 }}>
                Saved Accounts
              </Text>
              {savedAccounts.map(account => (
                <TouchableOpacity
                  key={`${account.serverUrl}::${account.email}`}
                  onPress={() => handleSelectAccount(account)}
                  onLongPress={() => handleDeleteAccount(account)}
                  style={[
                    styles.accountCard,
                    {
                      borderColor: theme.colors.outline + '40',
                      backgroundColor: theme.colors.surface,
                    },
                  ]}>
                  <View style={styles.accountInfo}>
                    <Text style={{ color: textColor, fontSize: 14, fontWeight: '500' }}>
                      {account.email}
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 11 }} numberOfLines={1}>
                      {account.serverUrl}
                    </Text>
                  </View>
                  <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Use →</Text>
                </TouchableOpacity>
              ))}
              <View style={[styles.divider, { borderColor: theme.colors.outline + '20' }]} />
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              setEditingUrl(serverUrl);
              setShowServerInput(true);
            }}
            style={[styles.serverRow, { borderColor: theme.colors.outline }]}>
            <Text style={{ color: mutedColor, fontSize: 12 }}>Server</Text>
            <Text style={{ color: theme.colors.primary, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {serverUrl}
            </Text>
            <Text style={{ color: faintColor, fontSize: 18 }}>✎</Text>
          </TouchableOpacity>

          {showServerInput && (
            <View
              style={[
                styles.serverEditBox,
                {
                  borderColor: theme.colors.outline,
                  backgroundColor: theme.colors.surface,
                },
              ]}>
              <TextInput
                style={[
                  styles.input,
                  { color: textColor, borderColor: theme.colors.primary },
                ]}
                placeholder="https://your-server.com"
                placeholderTextColor={faintColor}
                value={editingUrl}
                onChangeText={setEditingUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.serverEditActions}>
                <TouchableOpacity
                  onPress={() => setShowServerInput(false)}
                  style={styles.serverBtn}>
                  <Text style={{ color: mutedColor }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveUrl}
                  style={[
                    styles.serverBtn,
                    { backgroundColor: theme.colors.primary + '20' },
                  ]}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isRegister && (
            <TextInput
              style={[styles.input, { color: textColor, borderColor: theme.colors.outline }]}
              placeholder="Username"
              placeholderTextColor={mutedColor}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          )}

          <TextInput
            style={[styles.input, { color: textColor, borderColor: theme.colors.outline }]}
            placeholder="Email"
            placeholderTextColor={mutedColor}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={[styles.input, { color: textColor, borderColor: theme.colors.outline }]}
            placeholder="Password"
            placeholderTextColor={mutedColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor={theme.colors.primary}>
            {isRegister ? 'Sign Up' : 'Log In'}
          </Button>

          <TouchableOpacity
            onPress={() => setIsRegister(!isRegister)}
            style={styles.switchMode}>
            <Text style={{ color: mutedColor }}>
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                {isRegister ? 'Log In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    opacity: 0.7,
  },
  form: {
    gap: 14,
  },
  accountsSection: {
    gap: 6,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  divider: {
    borderBottomWidth: 1,
    marginTop: 6,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  serverEditBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  serverEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  serverBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 52,
    justifyContent: 'center',
    borderRadius: 12,
    marginTop: 4,
  },
  switchMode: {
    alignItems: 'center',
    marginTop: 12,
  },
});
