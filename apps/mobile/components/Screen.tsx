import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f4ed' },
  content: { padding: 24, gap: 18, width: '100%', maxWidth: 860, alignSelf: 'center' },
  title: { color: '#161616', fontSize: 32, fontWeight: '800' },
  body: { color: '#45413a', fontSize: 16, lineHeight: 24 },
  label: { color: '#9a5b13', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  input: { backgroundColor: '#fffdf7', borderColor: '#d4d4c5', borderWidth: 1, borderRadius: 8, padding: 14, color: '#161616', fontSize: 16, minHeight: 48 },
  button: { backgroundColor: '#161616', borderRadius: 8, padding: 14, minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  buttonText: { color: '#fffaf0', fontWeight: '700', fontSize: 15 },
  error: { color: '#8a2d2d', fontSize: 16, lineHeight: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
export function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={ui.buttonText}>{title}</Text></Pressable>;
}
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return <SafeAreaView style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <View><Button title="← Library" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /></View>
    <Text style={ui.title}>{title}</Text>{children}
  </ScrollView></SafeAreaView>;
}
