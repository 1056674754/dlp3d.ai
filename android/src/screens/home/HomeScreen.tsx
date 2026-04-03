import React, { useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  DrawerLayoutAndroid,
  Text,
  Pressable,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme, IconButton, Divider } from 'react-native-paper';
import { DLP3DWebView } from '@/components/webview';
import type { RootState } from '@/store';

type TabParamList = {
  Home: undefined;
  ChatList: undefined;
  Settings: undefined;
};

type HomeTabNav = BottomTabNavigationProp<TabParamList, 'Home'>;

/**
 * Home：全屏 WebView；Android 上页面为 `file:///android_asset/web/index.html`。
 * Android：左侧边缘滑出抽屉，快速进入 Chats / Settings（Phase 7 手势）。
 */
export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<HomeTabNav>();
  const drawerRef = useRef<DrawerLayoutAndroid>(null);

  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);
  const language = useSelector((state: RootState) => state.app.language);
  const appTheme = useSelector((state: RootState) => state.app.theme);

  const closeDrawer = useCallback(() => {
    drawerRef.current?.closeDrawer();
  }, []);

  const renderDrawer = useCallback(() => {
    return (
      <View
        style={[
          styles.drawer,
          { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.outline },
        ]}>
        <Text style={[styles.drawerTitle, { color: theme.colors.primary }]}>
          DLP3D
        </Text>
        <Text style={[styles.drawerHint, { color: theme.colors.onSurface }]}>
          Swipe from the left edge or use the buttons below
        </Text>
        <Divider style={styles.divider} />
        <Pressable
          style={({ pressed }) => [
            styles.drawerRow,
            { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
          ]}
          onPress={() => {
            closeDrawer();
            navigation.navigate('ChatList');
          }}>
          <IconButton icon="chat" size={22} iconColor={theme.colors.onSurface} />
          <Text style={[styles.drawerLabel, { color: theme.colors.onSurface }]}>
            Conversations
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.drawerRow,
            { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
          ]}
          onPress={() => {
            closeDrawer();
            navigation.navigate('Settings');
          }}>
          <IconButton icon="cog" size={22} iconColor={theme.colors.onSurface} />
          <Text style={[styles.drawerLabel, { color: theme.colors.onSurface }]}>
            Settings
          </Text>
        </Pressable>
      </View>
    );
  }, [closeDrawer, navigation, theme.colors]);

  const web = (
    <View style={styles.container}>
      <DLP3DWebView
        serverUrl={serverUrl}
        language={language}
        theme={appTheme}
      />
    </View>
  );

  if (Platform.OS === 'android') {
    return (
      <DrawerLayoutAndroid
        ref={drawerRef}
        drawerWidth={280}
        drawerPosition="left"
        renderNavigationView={renderDrawer}>
        {web}
      </DrawerLayoutAndroid>
    );
  }

  return web;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawer: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  drawerHint: {
    fontSize: 12,
    opacity: 0.75,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  divider: {
    marginVertical: 12,
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  drawerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
