/**
 * Drill screen (M3 plan §10): one complete Drill over a Quiz.
 *
 * Thin wiring over the Phase 1 machine (`packages/core/src/drill/`): tap to
 * flip, Mastered / Need Practice rating, prev/next, finish by advancing past
 * the last card. The machine's RECORDED result is shown — never recomputed —
 * then saved via `recordDrillFinish` under the `createDrillCompletion`
 * single-flight guard (plan §5.2, D9): rapid double-taps share one save, a
 * rejected save returns to a retryable error state reusing the same Attempt
 * payload (no duplicate ids on retry). Empty Quiz renders the D4 blocked
 * empty state: no Drill, no Attempt. Wiring only — the phone checklist is
 * the screen test (the M2 rule).
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  buildDrillAttempt,
  createDrillCompletion,
  createDrillSession,
  type DrillCompletion,
  type DrillSession,
  type StoredAttempt,
  type StoredQuiz,
  type Subject,
} from '@temari/core';
import { getStudyRepository } from '@/src/db/repository';
import { newRecordId } from '@/src/ids/newRecordId';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'ready'; quiz: StoredQuiz; subject: Subject }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string };

type SaveState =
  | { kind: 'unsaved' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'failed'; message: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function DrillScreen() {
  const router = useRouter();
  const { quizId, subjectId } = useLocalSearchParams<{ quizId: string; subjectId?: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });

  // ONE lifecycle mechanism (the M2 rule): reload on every focus, so a
  // replace-all import confirmed elsewhere is reflected on return.
  const aliveRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      getStudyRepository().then(
        (repo) => {
          if (!aliveRef.current) return;
          const qid = Array.isArray(quizId) ? quizId[0] : quizId;
          const sid = Array.isArray(subjectId) ? subjectId[0] : subjectId;
          if (typeof qid !== 'string') {
            setLoaded({ kind: 'missing' });
            return;
          }
          const quiz =
            typeof sid === 'string'
              ? repo.getQuiz(sid, qid)
              : (repo.snapshot().quizzes.find((candidate) => candidate.id === qid) ?? null);
          const subject = quiz !== null ? repo.getSubject(quiz.subjectId) : null;
          if (quiz === null || subject === null) {
            setLoaded({ kind: 'missing' });
            return;
          }
          setLoaded({ kind: 'ready', quiz, subject });
        },
        (error: unknown) => {
          if (aliveRef.current) setLoaded({ kind: 'failed', message: errorText(error) });
        },
      );
      return () => {
        aliveRef.current = false;
      };
    }, [quizId, subjectId]),
  );

  if (loaded.kind !== 'ready') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to subject"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Drill</Text>
        </View>
        <View style={styles.content}>
          {loaded.kind === 'loading' && <Text style={styles.body}>Loading…</Text>}
          {loaded.kind === 'missing' && (
            <Text style={styles.body}>
              This Quiz is not on this device. It may have been replaced by an import.
            </Text>
          )}
          {loaded.kind === 'failed' && (
            <Text style={styles.danger}>The Quiz could not be read: {loaded.message}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return <DrillRunner key={loaded.quiz.id} quiz={loaded.quiz} subject={loaded.subject} />;
}

function DrillRunner({ quiz, subject }: { quiz: StoredQuiz; subject: Subject }) {
  const router = useRouter();
  // The machine is created once per drill run. createDrillSession returns
  // null for an empty deck (plan D4) — the blocked empty state below, never
  // an Attempt. Restart swaps in a fresh machine via setSession.
  const [session, setSession] = useState<DrillSession | null>(() =>
    createDrillSession(quiz.flashcards),
  );
  const [, setTick] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'unsaved' });
  const completionRef = useRef<DrillCompletion<StoredAttempt> | null>(null);
  const attemptRef = useRef<StoredAttempt | null>(null);

  const rerender = useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);

  const completionForRun = useCallback((): DrillCompletion<StoredAttempt> => {
    if (completionRef.current === null) {
      completionRef.current = createDrillCompletion<StoredAttempt>({
        save: (attempt) =>
          getStudyRepository().then((repo) => repo.recordDrillFinish(attempt, quiz.id)),
      });
    }
    return completionRef.current;
  }, [quiz.id]);

  // Persist the recorded result exactly once per finish: the guard absorbs
  // rapid double-taps into the in-flight promise (D9), and the machine
  // absorbs post-done events so a second rate cannot rebuild the payload.
  // The Attempt payload is built once per run and reused on retry, so a
  // retry can never mint a second id.
  const persistIfDone = useCallback(
    (active: DrillSession) => {
      const snapshot = active.state();
      if (snapshot.status !== 'done' || snapshot.result === null) {
        rerender();
        return;
      }
      if (attemptRef.current === null) {
        attemptRef.current = buildDrillAttempt(
          {
            subjectId: subject.id,
            subjectName: subject.name,
            quizName: quiz.name,
            result: snapshot.result,
          },
          newRecordId,
        );
      }
      const attempt = attemptRef.current;
      setSaveState({ kind: 'saving' });
      rerender();
      completionForRun().finish(attempt).then(
        () => {
          setSaveState({ kind: 'saved' });
        },
        (error: unknown) => {
          setSaveState({ kind: 'failed', message: errorText(error) });
        },
      );
    },
    [completionForRun, quiz.name, subject.id, subject.name, rerender],
  );

  const retry = useCallback(() => {
    const attempt = attemptRef.current;
    if (attempt === null) return;
    setSaveState({ kind: 'saving' });
    completionForRun().finish(attempt).then(
      () => {
        setSaveState({ kind: 'saved' });
      },
      (error: unknown) => {
        setSaveState({ kind: 'failed', message: errorText(error) });
      },
    );
  }, [completionForRun]);

  const restart = useCallback(() => {
    completionRef.current = null;
    attemptRef.current = null;
    setSaveState({ kind: 'unsaved' });
    setSession(createDrillSession(quiz.flashcards));
    setTick((tick) => tick + 1);
  }, [quiz.flashcards]);

  const backToSubject = useCallback(() => {
    router.replace({ pathname: '/subject/[subjectId]', params: { subjectId: subject.id } });
  }, [router, subject.id]);

  if (session === null) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to subject"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>{quiz.name}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.body}>
            This Quiz has no Flashcards yet, so there is nothing to drill. Import a library with
            Flashcards to practise.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const snapshot = session.state();
  const cards = quiz.flashcards;
  const position = Math.min(snapshot.index, cards.length - 1);
  const card = cards[position];

  if (snapshot.status === 'done' && snapshot.result !== null) {
    const result = snapshot.result;
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to subject"
            onPress={backToSubject}
            style={styles.back}
          >
            <Text style={styles.backText}>← Subject</Text>
          </Pressable>
          <Text style={styles.title}>{quiz.name}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>DRILL COMPLETE</Text>
          <Text style={styles.score}>
            {result.score}% · {result.masteredCount}/{result.total} mastered
          </Text>
          {saveState.kind === 'unsaved' && <Text style={styles.body}>Preparing your Attempt…</Text>}
          {saveState.kind === 'saving' && <Text style={styles.body}>Saving your Attempt…</Text>}
          {saveState.kind === 'saved' && (
            <Text style={styles.body}>Saved to this Subject&apos;s history.</Text>
          )}
          {saveState.kind === 'failed' && (
            <View style={styles.errorBox}>
              <Text style={styles.danger}>Could not save: {saveState.message}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry saving attempt"
                onPress={retry}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <Text style={styles.buttonText}>Retry save</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restart drill"
              onPress={restart}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Restart drill</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to subject"
              onPress={backToSubject}
              style={({ pressed }) => [styles.secondary, pressed && styles.buttonPressed]}
            >
              <Text style={styles.secondaryText}>Back to subject</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to subject"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{quiz.name}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>
          CARD {position + 1} OF {cards.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={snapshot.flipped ? 'Hide answer' : 'Show answer'}
          accessibilityHint="Flips the current flashcard"
          onPress={() => {
            session.flip();
            rerender();
          }}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.cardQuestion}>{card.question}</Text>
          {snapshot.flipped ? (
            <Text style={styles.cardAnswer}>{card.answer}</Text>
          ) : (
            <Text style={styles.cardHint}>Tap to reveal the answer</Text>
          )}
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rate mastered"
            onPress={() => {
              session.rate('mastered');
              persistIfDone(session);
            }}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Mastered</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rate need practice"
            onPress={() => {
              session.rate('need-practice');
              persistIfDone(session);
            }}
            style={({ pressed }) => [styles.secondary, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryText}>Need Practice</Text>
          </Pressable>
        </View>
        <View style={styles.navRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous card"
            onPress={() => {
              session.prev();
              rerender();
            }}
            style={styles.link}
          >
            <Text style={styles.linkText}>← Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next card"
            accessibilityHint="Moves on without rating; on the last card this finishes the drill"
            onPress={() => {
              session.next();
              persistIfDone(session);
            }}
            style={styles.link}
          >
            <Text style={styles.linkText}>Next →</Text>
          </Pressable>
        </View>
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
  content: { paddingHorizontal: 28, paddingVertical: 24, gap: 16 },
  eyebrow: { color: '#9a5b13', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  body: { color: '#45413a', fontSize: 17, lineHeight: 25 },
  danger: { color: '#8a2d2d', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  score: { color: '#161616', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  card: {
    backgroundColor: '#fffdf7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4d4c5',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 220,
    justifyContent: 'center',
    gap: 12,
  },
  cardPressed: { opacity: 0.85 },
  cardQuestion: { color: '#161616', fontSize: 20, fontWeight: '700', lineHeight: 28 },
  cardAnswer: { color: '#242722', fontSize: 17, lineHeight: 25 },
  cardHint: { color: '#9a5b13', fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: '#fffaf0', fontSize: 15, fontWeight: '700' },
  secondary: {
    backgroundColor: '#fffdf7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#161616',
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: { color: '#161616', fontSize: 15, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  linkText: { color: '#2457a5', fontSize: 15, fontWeight: '600' },
  errorBox: { gap: 12 },
});
