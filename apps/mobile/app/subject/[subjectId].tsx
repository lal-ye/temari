/**
 * Active Subject screen (M3 plan §9–§10, D10): the opened Subject scopes
 * everything shown — its Notes, its Quizzes and its Attempt history, nothing
 * else. Quiz rows open the Drill route; history is newest first. Wiring
 * only — the phone checklist is the screen test (the M2 rule).
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getStudyRepository } from '@/src/db/repository';
import type { StoredAttempt, StoredNote, StoredQuiz, Subject } from '@temari/core';

type Loaded =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      subject: Subject;
      notes: StoredNote[];
      quizzes: StoredQuiz[];
      attempts: StoredAttempt[];
    }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SubjectScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });

  // ONE lifecycle mechanism (the M2 rule): reload on every focus, so a Drill
  // finished in Phase 6 is reflected on back-navigation.
  const aliveRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      getStudyRepository().then(
        (repo) => {
          if (!aliveRef.current) return;
          const id = Array.isArray(subjectId) ? subjectId[0] : subjectId;
          const subject = typeof id === 'string' ? repo.getSubject(id) : null;
          if (!subject) {
            setLoaded({ kind: 'missing' });
            return;
          }
          setLoaded({
            kind: 'ready',
            subject,
            notes: repo.listNotes(subject.id),
            quizzes: repo.listQuizzes(subject.id),
            attempts: repo.listAttempts(subject.id),
          });
        },
        (error: unknown) => {
          if (aliveRef.current) setLoaded({ kind: 'failed', message: errorText(error) });
        },
      );
      return () => {
        aliveRef.current = false;
      };
    }, [subjectId]),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to library"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {loaded.kind === 'ready' ? loaded.subject.name : 'Subject'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loaded.kind === 'loading' && <Text style={styles.body}>Loading…</Text>}
        {loaded.kind === 'missing' && (
          <Text style={styles.body}>This Subject is not on this device. It may have been replaced by an import.</Text>
        )}
        {loaded.kind === 'failed' && (
          <Text style={styles.danger}>The Subject could not be read: {loaded.message}</Text>
        )}
        {loaded.kind === 'ready' && (
          <>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>NOTES</Text>
              {loaded.notes.length === 0 ? (
                <Text style={styles.body}>No Notes in this Subject yet.</Text>
              ) : (
                loaded.notes.map((note) => (
                  <Pressable
                    key={note.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Read note ${note.title}`}
                    onPress={() =>
                      router.push({
                        pathname: '/note/[noteId]',
                        params: { noteId: note.id, subjectId: loaded.subject.id },
                      })
                    }
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Text style={styles.rowTitle}>{note.title}</Text>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>QUIZZES</Text>
              {loaded.quizzes.length === 0 ? (
                <Text style={styles.body}>No Quizzes in this Subject yet.</Text>
              ) : (
                loaded.quizzes.map((quiz) => (
                  <Pressable
                    key={quiz.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Drill quiz ${quiz.name}`}
                    onPress={() =>
                      router.push({
                        pathname: '/drill/[quizId]',
                        params: { quizId: quiz.id, subjectId: loaded.subject.id },
                      })
                    }
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Text style={styles.rowTitle}>{quiz.name}</Text>
                    <Text style={styles.rowMeta}>
                      {quiz.flashcards.length} Flashcards
                      {quiz.lastScore !== undefined ? ` · Last score ${quiz.lastScore}` : ''}
                      {quiz.timesPracticed !== undefined && quiz.timesPracticed > 0
                        ? ` · Practiced ${quiz.timesPracticed}×`
                        : ''}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>HISTORY</Text>
              {loaded.attempts.length === 0 ? (
                <Text style={styles.body}>No Attempts in this Subject yet. Finish a Drill to record one.</Text>
              ) : (
                loaded.attempts.map((attempt) => (
                  <View key={attempt.id} style={styles.row}>
                    <Text style={styles.rowTitle}>{attempt.name}</Text>
                    <Text style={styles.rowMeta}>
                      {attempt.overallScore}% · {attempt.correctQuestions}/{attempt.totalQuestions} ·{' '}
                      {attempt.date.slice(0, 10)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f4ed' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4c5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 12,
  },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#2457a5', fontSize: 16, fontWeight: '600' },
  title: { flexShrink: 1, fontSize: 15, color: '#242722', fontWeight: '600' },
  content: { paddingHorizontal: 28, paddingVertical: 24, gap: 24 },
  section: { gap: 12 },
  eyebrow: { color: '#9a5b13', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  body: { color: '#45413a', fontSize: 17, lineHeight: 25 },
  danger: { color: '#8a2d2d', fontSize: 16, lineHeight: 24, fontWeight: '600' },
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
});
