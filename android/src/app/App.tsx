import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, PaperProvider, IconButton } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import { configureStore } from '@reduxjs/toolkit';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { persistedReducer } from '@/store';
import { darkTheme, lightTheme } from '@/theme/theme';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ChatListScreen } from '@/screens/chat/ChatListScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setIsLogin } from '@/store/authSlice';
import type { CharacterConfig } from '@/bridge/types';

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false }),
});

export const persistor = persistStore(store);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  const theme = useTheme();
  const dispatch = useDispatch();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outline + '40',
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurface + '60',
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'DLP3D',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="home" iconColor={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatList"
        options={{
          title: 'Conversations',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="chat" iconColor={color} size={size} />
          ),
        }}>
        {() => (
          <ChatListScreen
            onSelectChat={(_chat: CharacterConfig) => {}}
            onDeleteChat={(_chatId: string) => {}}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="cog" iconColor={color} size={size} />
          ),
        }}>
        {() => (
          <SettingsScreen onLogout={() => dispatch(setIsLogin(false))} />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const isLogin = useSelector((state: RootState) => state.auth.isLogin);
  const dispatch = useDispatch();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        {!isLogin ? (
          <Stack.Screen name="Auth">
            {() => (
              <AuthScreen
                onLogin={(_userId: string, _email: string) => {
                  dispatch(setIsLogin(true));
                }}
                onRegister={(_userId: string, _email: string) => {
                  dispatch(setIsLogin(true));
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const appTheme = store.getState().app.theme;
  const paperTheme = appTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={paperTheme}>
        <SafeAreaProvider>
          <PersistGate
            loading={null}
            persistor={persistor}>
            <AppNavigator />
          </PersistGate>
        </SafeAreaProvider>
      </PaperProvider>
    </ReduxProvider>
  );
}
