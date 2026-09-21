import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DeviceCheckScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>M0 · DEVICE CHECK</Text>
        <Text style={styles.title}>Back navigation works.</Text>
        <Text style={styles.body}>
          Use the Android system Back button or this control to return to the hello screen. This route is only a
          native navigation and safe-area smoke test.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to hello screen"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Back to hello</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e9f0ff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  eyebrow: {
    color: '#2457a6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#142033',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  body: {
    color: '#35445b',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 360,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#2457a6',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
