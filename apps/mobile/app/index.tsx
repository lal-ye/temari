import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HelloScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>ተማሪ · ANDROID PROTOTYPE</Text>
        <Text style={styles.title}>Temari is ready.</Text>
        <Text style={styles.body}>
          This is the native baseline on the target Android device. No study data or network request is used yet.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open device check"
          onPress={() => router.push('/device-check')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Open device check</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f4ed',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  eyebrow: {
    color: '#9a5b13',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#161616',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  body: {
    color: '#45413a',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 360,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#fffaf0',
    fontSize: 15,
    fontWeight: '700',
  },
});
