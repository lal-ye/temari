/**
 * Library screen (M3 plan §9): the app's home. Subject list, import entry,
 * empty state. The hello hub retires here; device-check stays reachable as a
 * diagnostic. Wiring only — the phone checklist is the screen test (the M2
 * rule).
 */
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SubjectSummary } from '@temari/core';
import { getStudyRepository } from '../src/db/repository';

export default function LibraryScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);

  // ONE lifecycle mechanism (the M2 rule): reload on every focus, so an
  // import confirmed on the import screen is visible on back-navigation, and
  // a relaunch boots to persisted data. Web has no library storage in M3, so
  // there is nothing to reload there.
  const aliveRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      if (Platform.OS === 'web') return;
      getStudyRepository().then(
        (repo) => {
          if (aliveRef.current) setSubjects(repo.listSubjects());
        },
        () => {
          // A failed load reads as an empty library; the import screen's
          // outcome states carry the actual errors.
          if (aliveRef.current) setSubjects([]);
        },
      );
      return () => {
        aliveRef.current = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ተማሪ · LIBRARY</Text>
        <Text style={styles.title}>Study library</Text>
        {Platform.OS === 'web' ? (
          <Text style={styles.body}>
            The on-device library lives in the Android app — this web build has no library storage in this
            milestone.
          </Text>
        ) : subjects.length === 0 ? (
          <Text style={styles.body}>No Subjects on this device yet. Import a library to begin.</Text>
        ) : (
          subjects.map((subject) => (
            <Pressable
              key={subject.id}
              accessibilityRole="button"
              accessibilityLabel={`Open subject ${subject.name}`}
              onPress={() => router.push({ pathname: '/subject/[subjectId]', params: { subjectId: subject.id } })}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text style={styles.rowTitle}>{subject.name}</Text>
              <Text style={styles.rowMeta}>
                {subject.noteCount} Notes · {subject.quizCount} Quizzes
              </Text>
            </Pressable>
          ))
        )}
        {Platform.OS !== 'web' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import library data"
            onPress={() => router.push('/import')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Import library data</Text>
          </Pressable>
        )}
        <View style={styles.diagnostics}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open device check"
            onPress={() => router.push('/device-check')}
            style={styles.link}
          >
            <Text style={styles.linkText}>Device check</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f4ed' },
  content: { paddingHorizontal: 28, paddingVertical: 24, gap: 16 },
  eyebrow: { color: '#9a5b13', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#161616', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  body: { color: '#45413a', fontSize: 17, lineHeight: 25 },
  row: {
    backgroundColor: '#fffdf7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4d4c5',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
  },
  rowPressed: { opacity: 0.78 },
  rowTitle: { color: '#161616', fontSize: 17, fontWeight: '700' },
  rowMeta: { color: '#45413a', fontSize: 14 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: '#fffaf0', fontSize: 15, fontWeight: '700' },
  diagnostics: { flexDirection: 'row', gap: 8, marginTop: 8 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  linkText: { color: '#2457a5', fontSize: 15, fontWeight: '600' },
});
