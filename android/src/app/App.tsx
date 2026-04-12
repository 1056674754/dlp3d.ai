import '@/theme/fontScaling';
import '@/i18n/config';
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
import { useTheme, PaperProvider } from 'react-native-paper';
import {
  Provider as ReduxProvider,
  useSelector,
  useDispatch,
} from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar, Platform } from 'react-native';
import { store, persistor } from '@/store';
import type { RootState } from '@/store';
import { darkTheme, lightTheme } from '@/theme/theme';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import ChatListScreen from '@/screens/chat/ChatListScreen';
import { useWebViewChatSync } from '@/hooks/useWebViewChatSync';
import { useAndroidRuntimePermissions } from '@/hooks/useAndroidRuntimePermissions';
import { AppSettingsScreen } from '@/screens/settings/AppSettingsScreen';
import { SettingsScreen as CharacterSettingsScreen } from '@/screens/settings/SettingsScreen';
import { PromptEditorScreen } from '@/screens/settings/PromptEditorScreen';
import { setIsLogin } from '@/store/authSlice';
import DebugOverlay from '@/components/DebugOverlay';
import { pushDebugLog } from '@/store/debugLogStore';
import { SplashScreen } from '@/screens/splash/SplashScreen';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  CharacterSettings: undefined;
  CharacterPromptEditor: {
    characterId: string;
    characterName: string;
    initialPrompt: string;
    readOnly: boolean;
  };
};

type MainTabParamList = {
  Home: undefined;
  ChatList: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/** Minimum splash time after rehydration (Phase 7). */
const SPLASH_MIN_MS = 1400;

function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useWebViewChatSync();
  useAndroidRuntimePermissions();
  const androidBottomInset =
    Platform.OS === 'android' ? Math.max(insets.bottom, 12) : insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleAllowFontScaling: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        /** Ensures tab scenes get bounded height so inner ScrollViews can scroll (Android). */
        sceneStyle: { flex: 1 },
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outline + '40',
          height: 46 + androidBottomInset,
          paddingTop: 2,
          paddingBottom: Math.max(androidBottomInset - 6, 6),
        },
        tabBarItemStyle: {
          paddingTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: Platform.OS === 'android' ? 1 : 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurface + '60',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('navigation.homeTitle'),
          headerShown: Platform.OS !== 'android',
          tabBarLabel: t('common.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={Math.max(18, size - 3)}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: t('navigation.conversationsTitle'),
          tabBarLabel: t('common.chats'),
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'chat' : 'chat-outline'}
              color={color}
              size={Math.max(18, size - 3)}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={AppSettingsScreen}
        options={{
          title: t('navigation.settingsTitle'),
          tabBarLabel: t('common.settings'),
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              color={color}
              size={Math.max(18, size - 3)}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
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
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="CharacterSettings"
              component={CharacterSettingsScreen}
              options={{
                headerShown: true,
                title: t('navigation.characterSettingsTitle'),
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: { fontSize: 17, fontWeight: '600' },
              }}
            />
            <Stack.Screen
              name="CharacterPromptEditor"
              component={PromptEditorScreen}
              options={{
                headerShown: true,
                title: t('navigation.promptEditorTitle'),
                headerStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.onSurface,
                headerTitleStyle: { fontSize: 17, fontWeight: '600' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** Paper + StatusBar follow Redux `app.theme` (Phase 7 dark mode). */
function ThemedApp() {
  const themeMode = useSelector((state: RootState) => state.app.theme);
  const language = useSelector((state: RootState) => state.app.language);
  const paperTheme = themeMode === 'dark' ? darkTheme : lightTheme;
  const barStyle = themeMode === 'dark' ? 'light-content' : 'dark-content';

  useEffect(() => {
    pushDebugLog('rn', 'App mounted, theme=' + themeMode);
  }, [themeMode]);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={paperTheme.colors.background}
      />
      <SafeAreaProvider>
        <AppNavigator />
        <DebugOverlay />
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
