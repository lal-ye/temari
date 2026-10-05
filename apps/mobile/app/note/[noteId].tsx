/**
 * Library-backed Note reading (M3 plan §9): the reader's content source moves
 * from the bundled kitchen-sink fixture to repository data, through the
 * unchanged 'use dom' seam. The note arrives as `noteId` (route segment) plus
 * `subjectId` (query) — reads stay Subject-scoped (D10). Wiring only — the
 * phone checklist is the screen test (the M2 rule).
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getStudyRepository } from '@/src/db/repository';
import NoteReaderHost from '@/components/NoteReaderHost';
import type { StoredNote } from '@temari/core';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'ready'; note: StoredNote }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function NoteScreen() {
  const router = useRouter();
  const { noteId, subjectId } = useLocalSearchParams<{ noteId: string; subjectId?: string }>();
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
          const nid = Array.isArray(noteId) ? noteId[0] : noteId;
          const sid = Array.isArray(subjectId) ? subjectId[0] : subjectId;
          const note =
            typeof nid === 'string' && typeof sid === 'string' ? repo.getNote(sid, nid) : null;
          setLoaded(note ? { kind: 'ready', note } : { kind: 'missing' });
        },
        (error: unknown) => {
          if (aliveRef.current) setLoaded({ kind: 'failed', message: errorText(error) });
        },
      );
      return () => {
        aliveRef.current = false;
      };
    }, [noteId, subjectId]),
  );

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
        <Text style={styles.title}>{loaded.kind === 'ready' ? loaded.note.title : 'Note'}</Text>
      </View>
      {loaded.kind === 'ready' ? (
        <NoteReaderHost title={loaded.note.title} content={loaded.note.content} noteId={loaded.note.id} />
      ) : (
        <View style={styles.content}>
          {loaded.kind === 'loading' && <Text style={styles.body}>Loading…</Text>}
          {loaded.kind === 'missing' && (
            <Text style={styles.body}>
              This Note is not on this device. It may have been replaced by an import.
            </Text>
          )}
          {loaded.kind === 'failed' && (
            <Text style={styles.danger}>The Note could not be read: {loaded.message}</Text>
          )}
        </View>
      )}
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
  content: { paddingHorizontal: 28, paddingVertical: 24 },
  body: { color: '#45413a', fontSize: 17, lineHeight: 25 },
  danger: { color: '#8a2d2d', fontSize: 16, lineHeight: 24, fontWeight: '600' },
});
