import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontWeight: '400' as const },
  displayMedium: { fontFamily: 'System', fontWeight: '400' as const },
  displaySmall: { fontFamily: 'System', fontWeight: '400' as const },
  headlineLarge: { fontFamily: 'System', fontWeight: '400' as const },
  headlineMedium: { fontFamily: 'System', fontWeight: '400' as const },
  headlineSmall: { fontFamily: 'System', fontWeight: '400' as const },
  titleLarge: { fontFamily: 'System', fontWeight: '700' as const },
  titleMedium: { fontFamily: 'System', fontWeight: '600' as const },
  titleSmall: { fontFamily: 'System', fontWeight: '500' as const },
  bodyLarge: { fontFamily: 'System', fontWeight: '400' as const },
  bodyMedium: { fontFamily: 'System', fontWeight: '400' as const },
  bodySmall: { fontFamily: 'System', fontWeight: '400' as const },
  labelLarge: { fontFamily: 'System', fontWeight: '500' as const },
  labelMedium: { fontFamily: 'System', fontWeight: '500' as const },
  labelSmall: { fontFamily: 'System', fontWeight: '500' as const },
};

const dlp3dColors = {
  primary: '#6C63FF',
  primaryContainer: '#9E97FF',
  secondary: '#FF6584',
  secondaryContainer: '#FF97AD',
  surface: '#1A1A2E',
  surfaceVariant: '#252540',
  background: '#0F0F1A',
  error: '#FF5252',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
  onSurface: '#E8E8F0',
  onBackground: '#E8E8F0',
  outline: '#3A3A5C',
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...dlp3dColors,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 12,
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6C63FF',
    primaryContainer: '#E0DFFF',
    secondary: '#FF6584',
    secondaryContainer: '#FFE0E8',
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 12,
};
