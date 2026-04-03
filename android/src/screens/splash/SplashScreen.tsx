import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useTheme } from 'react-native-paper';

export function SplashScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>DLP3D</Text>
      <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
        Digital Life Project
      </Text>
      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        style={styles.loader}
      />
      <Text style={[styles.hint, { color: theme.colors.onSurface }]}>
        Loading…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    opacity: 0.7,
  },
  loader: {
    marginTop: 40,
  },
  hint: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.6,
  },
});
