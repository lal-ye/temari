import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReaderAssetSpikeDOM from '../components/ReaderAssetSpikeDOM';
import fixture from '../../../fixtures/mobile/reader-kitchen-sink.json';

export default function ReaderSpikeScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to hello" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Offline reader · asset spike</Text>
    </View>
    <ReaderAssetSpikeDOM title={fixture.title} content={fixture.content} dom={{
      style: { flex: 1 },
      // No general-purpose native-module access from the DOM context.
      unstable_useExpoModulesBridge: false,
    }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f4ed' },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#d4d4c5', paddingHorizontal: 12, paddingVertical: 4, gap: 12 },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#2457a5', fontSize: 16, fontWeight: '600' },
  title: { flexShrink: 1, fontSize: 15, color: '#242722', fontWeight: '600' },
});
