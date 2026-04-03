import '@/theme/fontScaling';
import React, { useEffect, useState } from 'react';
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';

/**
 * 避免 native-screens 与 Tab 内 ScrollView/列表手势冲突（部分机型整页无法竖滑、像没更新）。
 * @see https://github.com/software-mansion/react-native-screens/issues
 */
enableScreens(false);
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, PaperProvider, IconButton } from 'react-native-paper';
import { Provider as ReduxProvider, useSelector } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import { configureStore } from '@reduxjs/toolkit';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { persistedReducer } from '@/store';
import { darkTheme, lightTheme } from '@/theme/theme';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import ChatListScreen from '@/screens/chat/ChatListScreen';
import { useWebViewChatSync } from '@/hooks/useWebViewChatSync';
import { useAndroidRuntimePermissions } from '@/hooks/useAndroidRuntimePermissions';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { setIsLogin } from '@/store/authSlice';
import { SplashScreen } from '@/screens/splash/SplashScreen';

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export const persistor = persistStore(store);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Minimum splash time after rehydration (Phase 7). */
const SPLASH_MIN_MS = 1400;

function MainTabNavigator() {
  const theme = useTheme();
  useWebViewChatSync();
  useAndroidRuntimePermissions();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        /** Ensures tab scenes get bounded height so inner ScrollViews can scroll (Android). */
        sceneStyle: { flex: 1 },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outline + '40',
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurface + '60',
      }}
    >
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
        component={ChatListScreen}
        options={{
          title: 'Conversations',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="chat" iconColor={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="cog" iconColor={color} size={size} />
          ),
        }}
      />
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
          animation: 'fade',
        }}
      >
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

/** Paper + StatusBar follow Redux `app.theme` (Phase 7 dark mode). */
function ThemedApp() {
  const themeMode = useSelector((state: RootState) => state.app.theme);
  const paperTheme = themeMode === 'dark' ? darkTheme : lightTheme;
  const barStyle = themeMode === 'dark' ? 'light-content' : 'dark-content';

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={paperTheme.colors.background}
      />
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </PaperProvider>
  );
}

/**
 * After persist rehydration, keep splash visible for SPLASH_MIN_MS so branding
 * is visible (Phase 7).
 */
function AppShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, []);

  if (!ready) {
    return <SplashScreen />;
  }
  return <ThemedApp />;
}

export default function App() {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<SplashScreen />} persistor={persistor}>
        <AppShell />
      </PersistGate>
    </ReduxProvider>
  );
}
