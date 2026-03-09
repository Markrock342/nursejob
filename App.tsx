// ============================================
// NURSEGO APP - Production Ready Entry Point
// ============================================
// This is the main entry file for the NurseGo application
// A platform for nurses to find healthcare job opportunities in Thailand
// ============================================

// Polyfill: some packages check `process.stdout.isTTY` which doesn't exist on web
// Ensure a minimal `process.stdout` exists before other imports run
if (typeof global.process === 'undefined') {
  (global as any).process = { env: {} };
}
if (!(global as any).process.stdout) {
  (global as any).process.stdout = { isTTY: false };
}

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput } from 'react-native';
import * as ExpoFont from 'expo-font';
import {
  Sarabun_400Regular,
  Sarabun_500Medium,
  Sarabun_600SemiBold,
  Sarabun_700Bold,
} from '@expo-google-fonts/sarabun';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';

// Init Sentry early (before any component renders)
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  enabled: !__DEV__, // ปิดใน dev เพื่อไม่ให้ส่ง event ตอนทดสอบ
  tracesSampleRate: 0.2,
  debug: false,
});

// Context Providers
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

// UI Kitten
import { ApplicationProvider, IconRegistry } from '@ui-kitten/components';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import * as eva from '@eva-design/eva';
import { getEvaTheme } from './src/theme/uiKitten';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/components/common/SplashScreen';

// ============================================
// Sentry Crash Tracking
// ============================================
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Disable in development
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
});

// ============================================
// APP CONTENT WITH THEME
// ============================================
function AppContent() {
  const { colors, isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <StatusBar
              style={isDark ? 'light' : 'dark'}
              backgroundColor={colors.background}
            />
            <AppNavigator />
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </View>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================
// Set Sarabun as default font for all Text/TextInput (applied once after font loads)
function applyGlobalFont() {
  const style = { fontFamily: 'Sarabun_400Regular' };
  if (!(Text      as any).__fontPatched) { (Text      as any).defaultProps      = { ...(Text      as any).defaultProps,      style }; (Text      as any).__fontPatched      = true; }
  if (!(TextInput as any).__fontPatched) { (TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, style }; (TextInput as any).__fontPatched = true; }
}

export default Sentry.wrap(function App() {
  const [fontsLoaded] = ExpoFont.useFonts({
    Sarabun_400Regular,
    Sarabun_500Medium,
    Sarabun_600SemiBold,
    Sarabun_700Bold,
  });

  if (!fontsLoaded) return null; // wait for Thai font before rendering

  applyGlobalFont();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <IconRegistry icons={EvaIconsPack} />
          <ThemedApplication>
            <AppContent />
          </ThemedApplication>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});

function ThemedApplication({ children }: { children: React.ReactNode }) {
  const { paletteId, isDark } = useTheme();

  const evaTheme = getEvaTheme(paletteId, isDark);

  return (
    <ApplicationProvider {...eva} theme={evaTheme}>
      {children}
    </ApplicationProvider>
  );
}
