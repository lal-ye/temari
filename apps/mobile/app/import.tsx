/**
 * Import screen (M3 plan §8): pick → read → preview → confirm replace-all →
 * outcome. Zero writes before the confirm, and the confirm copy states the
 * wipe explicitly (D1). All parsing and legacy migration happens in
 * src/importFlow.ts before any write; a cancel at pick, preview or confirm
 * changes nothing.
 *
 * The "Current library" section reloads on every focus — it is the visible
 * proof for device checkpoint A: relaunch shows the same Subjects
 * (persistence), and a cancelled, rejected or failed import leaves it
 * unchanged (old library intact). Wiring only — the phone checklist is the
 * screen test (the M2 rule).
 */
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDocumentAsync } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { PortableCounts, SubjectSummary } from '@temari/core';
import { getStudyRepository } from '../src/db/repository';
import { buildImportPreview, type ImportPreview } from '../src/importFlow';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'preview'; preview: ImportPreview; fileName: string }
  | { kind: 'importing'; preview: ImportPreview; fileName: string }
  | { kind: 'done'; counts: PortableCounts }
  | { kind: 'failed'; message: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function countsLine(counts: PortableCounts): string {
  return [
    `${counts.subjects} Subjects`,
    `${counts.notes} Notes`,
    `${counts.quizzes} Quizzes`,
    `${counts.flashcards} Flashcards`,
    `${counts.attempts} Attempts`,
    `${counts.tasks} Study Tasks`,
  ].join(' · ');
}

export default function ImportScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [library, setLibrary] = useState<SubjectSummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // ONE lifecycle mechanism (the M2 rule): useFocusEffect covers both mount
  // and refocus, so relaunch and back-navigation both reload the library.
  // Web has no library storage in M3, so there is nothing to reload there.
  const aliveRef = useRef(true);
  const refreshLibrary = useCallback(() => {
    if (Platform.OS === 'web') return;
    getStudyRepository().then(
      (repo) => {
        if (!aliveRef.current) return;
        setLibrary(repo.listSubjects());
        setLibraryError(null);
      },
      (error: unknown) => {
        if (!aliveRef.current) return;
        setLibraryError(errorText(error));
      },
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      refreshLibrary();
      return () => {
        aliveRef.current = false;
      };
    }, [refreshLibrary]),
  );

  const pickExportFile = useCallback(async () => {
    // The picker's cache copy is NOT guaranteed: Samsung My Files hands the
    // MediaProvider's content:// URI straight back and the new expo-file-system
    // File class (java.io.File based) cannot open content URIs — the read dies
    // with a SecurityException. The legacy readAsStringAsync goes through the
    // ContentResolver instead, so it reads both file:// and content:// URIs.
    // The §15 SAF-vs-cache-copy decision: read whatever the picker returns.
    const result = await getDocumentAsync();
    if (result.canceled) return; // cancel at pick: zero writes
    const asset = result.assets?.[0];
    if (!asset) return;
    setPhase({ kind: 'reading' });
    try {
      const bytes = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setPhase({
        kind: 'preview',
        preview: buildImportPreview(bytes),
        fileName: asset.name || 'export',
      });
    } catch (error) {
      setPhase({ kind: 'failed', message: `Could not read the file: ${errorText(error)}` });
    }
  }, []);

  const confirmImport = useCallback(
    async (preview: ImportPreview) => {
      if (preview.kind !== 'ready') return;
      setPhase((current) =>
        current.kind === 'preview' ? { kind: 'importing', preview, fileName: current.fileName } : current,
      );
      try {
        const repo = await getStudyRepository();
        const counts = await repo.importPortable(preview.value);
        setPhase({ kind: 'done', counts });
      } catch (error) {
        // The repository never partially writes: the old library is intact.
        setPhase({
          kind: 'failed',
          message: `The import failed and nothing was changed: ${errorText(error)}`,
        });
      }
      refreshLibrary();
    },
    [refreshLibrary],
  );

  const cancelPreview = useCallback(() => setPhase({ kind: 'idle' }), []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Import</Text>
      </View>
      {Platform.OS === 'web' ? (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.eyebrow}>ANDROID APP ONLY</Text>
            <Text style={styles.body}>
              Importing a library runs on the Android app — the web build has no on-device library
              storage in this milestone.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.eyebrow}>CURRENT LIBRARY</Text>
            {libraryError !== null ? (
              <Text style={styles.danger}>The library could not be read: {libraryError}</Text>
            ) : library.length === 0 ? (
              <Text style={styles.body}>No Subjects on this device yet.</Text>
            ) : (
              library.map((subject) => (
                <Text key={subject.id} style={styles.libraryRow}>
                  {subject.name}
                  <Text style={styles.libraryMeta}> · {subject.noteCount} Notes · {subject.quizCount} Quizzes</Text>
                </Text>
              ))
            )}
          </View>

        {phase.kind === 'idle' && (
          <View style={styles.section}>
            <Text style={styles.body}>
              Pick a temari-portable export or a legacy v1 browser backup. You will see a preview before anything
              changes.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick an export file"
              onPress={() => void pickExportFile()}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Pick an export file</Text>
            </Pressable>
          </View>
        )}

        {phase.kind === 'reading' && <Text style={styles.status}>Reading the file…</Text>}

        {(phase.kind === 'preview' || phase.kind === 'importing') && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>PREVIEW · {phase.fileName.toUpperCase()}</Text>
            {phase.preview.kind === 'ready' ? (
              <>
                <Text style={styles.body}>{countsLine(phase.preview.counts)}</Text>
                {phase.preview.legacyWarnings.map((warning) => (
                  <View key={warning} style={styles.legacyPanel}>
                    <Text style={styles.legacyEyebrow}>LEGACY BACKUP MIGRATED</Text>
                    <Text style={styles.legacyBody}>{warning}</Text>
                    <Text style={styles.legacyBody}>
                      Credentials in the backup are discarded — they are never imported to this device.
                    </Text>
                  </View>
                ))}
                <Text style={styles.danger}>
                  Importing replaces your entire library on this device — everything currently here is deleted
                  first.
                </Text>
                {phase.kind === 'preview' ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Replace library and import this file"
                      onPress={() => void confirmImport(phase.preview)}
                      style={({ pressed }) => [styles.button, styles.buttonDanger, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.buttonText}>Replace and import</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancel import"
                      onPress={cancelPreview}
                      style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.actionButtonText}>Cancel import</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.status}>Importing…</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.danger}>This file is not a valid export. Nothing was changed.</Text>
                {phase.preview.issues.slice(0, 8).map((issue, index) => (
                  <Text key={`${issue.path}-${index}`} style={styles.issue}>
                    {issue.path} — {issue.message} ({issue.code})
                  </Text>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to import"
                  onPress={cancelPreview}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.actionButtonText}>Back</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {phase.kind === 'done' && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>IMPORTED</Text>
            <Text style={styles.body}>{countsLine(phase.counts)}</Text>
            <Text style={styles.body}>The library above now shows what is on this device.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import another file"
              onPress={cancelPreview}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.actionButtonText}>Import another file</Text>
            </Pressable>
          </View>
        )}

        {phase.kind === 'failed' && (
          <View style={styles.section}>
            <Text style={styles.danger}>{phase.message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to import"
              onPress={cancelPreview}
              style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.actionButtonText}>Back</Text>
            </Pressable>
          </View>
        )}
        </ScrollView>
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
  content: { paddingHorizontal: 28, paddingVertical: 24, gap: 24 },
  section: { gap: 12 },
  eyebrow: { color: '#9a5b13', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  body: { color: '#45413a', fontSize: 17, lineHeight: 25 },
  status: { color: '#45413a', fontSize: 15, lineHeight: 22 },
  libraryRow: { color: '#161616', fontSize: 17, fontWeight: '600' },
  libraryMeta: { color: '#45413a', fontSize: 14, fontWeight: '400' },
  danger: { color: '#8a2d2d', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  issue: { color: '#45413a', fontSize: 13, lineHeight: 19 },
  legacyPanel: {
    backgroundColor: '#1d2433',
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  legacyEyebrow: { color: '#f0b429', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  legacyBody: { color: '#d9e2f1', fontSize: 14, lineHeight: 20 },
  actions: { gap: 10 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDanger: { backgroundColor: '#8a2d2d' },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: '#fffaf0', fontSize: 15, fontWeight: '700' },
  actionButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionButtonText: { color: '#2457a5', fontSize: 15, fontWeight: '600' },
});
