import { useEffect } from 'react';
import { registerOfflineShell } from '@/src/platform/offline';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  useEffect(registerOfflineShell, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppErrorBoundary><Stack screenOptions={{ headerShown: false, animation: 'none' }} /></AppErrorBoundary>
    </SafeAreaProvider>
  );
}
