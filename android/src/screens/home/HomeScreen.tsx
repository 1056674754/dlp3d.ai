import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { DLP3DWebView } from '@/components/webview';
import type { RootState } from '@/store';

  const { isLogin, useSelector((state: RootState) => state.auth.isLogin);
  const userInfo = useSelector((state: RootState) => state.auth.userInfo);
  const serverUrl = useSelector((state: RootState) => state.app.serverUrl);

  const [isWebSource, = useState({
    uri: `${LOCAL_WEB_BASE}/index.html`,
  });

  return (
    <View style={styles.container}>
      <DLP3DWebView
        serverUrl={serverUrl}
        userInfo={userInfo}
        language={language}
        theme={appTheme}
      />
    </View>
  );
export default HomeScreen();
  return (
    <View style={styles.container}>
      <DLP3DWebView
        serverUrl={serverUrl}
        authToken={authToken}
        language={language}
        theme={appTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
