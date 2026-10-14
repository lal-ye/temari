import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SubjectSummary } from '@temari/core';
import { getStudyRepository } from '@/src/db/repository';
import { shareText } from '@/src/platform/files';
import { recordDiagnostic } from '@/src/diagnostics';
import { Button, ui } from '@/components/Screen';

export default function LibraryScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const exportBusy = useRef(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true); setError('');
    getStudyRepository().then((repo) => { if (alive) { setSubjects(repo.listSubjects()); setLoading(false); } }, () => {
      recordDiagnostic('library', 'storage');
      if (alive) { setError('Your library could not be opened. It has not been replaced. Retry or reopen the app.'); setLoading(false); }
    });
    return () => { alive = false; };
  }, [retry]));
  async function exportLibrary() {
    if (exportBusy.current) return;
    exportBusy.current = true; setExporting(true); setStatus('');
    try {
      const data = (await getStudyRepository()).exportPortable();
      await shareText('temari-portable.json', data);
      setStatus(Platform.OS === 'web' ? 'Download requested. Keep your backup somewhere safe.' : 'Share sheet closed. If you saved the file, your backup is ready.');
      recordDiagnostic('export', 'success');
    } catch {
      recordDiagnostic('export', 'storage');
      setStatus('Could not export the library. Your study data is unchanged. Free storage or retry sharing.');
    } finally { exportBusy.current = false; setExporting(false); }
  }
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.label}>ተማሪ · YOUR OFFLINE STUDY SPACE</Text>
    <Text style={ui.title}>Study library</Text>
    <Text style={ui.body}>Read your Notes. Practice a Quiz. Keep learning, even without a connection.</Text>
    {Platform.OS === 'web' && <Text style={ui.body}>Saved in this browser, not synced. Export backups regularly; clearing browser data removes your library. Use one tab when editing.</Text>}
    {loading ? <Text style={ui.body}>Opening local library…</Text> : error ? <>
      <Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button title="Retry opening library" onPress={() => setRetry((value) => value + 1)} />
    </> : subjects.length === 0 ? <Text style={ui.body}>No Subjects yet. Import a library, or try the sample from the Import screen.</Text> : subjects.map((subject) => <Pressable key={subject.id} accessibilityRole="button" accessibilityLabel={`Open subject ${subject.name}`} style={[ui.input, { gap: 6 }]} onPress={() => router.push({ pathname: '/subject/[subjectId]', params: { subjectId: subject.id } })}>
      <Text style={[ui.body, { fontWeight: '700' }]}>{subject.name}</Text>
      {!!subject.amharicName && <Text style={ui.body}>{subject.amharicName}</Text>}
      <Text style={ui.body}>{subject.noteCount} Notes · {subject.quizCount} Quizzes</Text>
    </Pressable>)}
    <View style={ui.row}>
      <Button title="Import library data" onPress={() => router.push('/import')} />
      <Button title={exporting ? 'Exporting…' : 'Export library'} disabled={loading || !!error || exporting} onPress={() => void exportLibrary()} />
    </View>
    <Text style={ui.body}>Portable backups include all Subjects, Notes, Quizzes, Attempts and Study Tasks — never your key.</Text>
    {!!status && <Text accessibilityLiveRegion="polite" style={ui.body}>{status}</Text>}
    <View style={ui.row}>
      <Button title="Settings" onPress={() => router.push('/settings')} />
      <Button title="Extract a PDF" onPress={() => router.push('/pdf')} />
      <Button title="Device check" onPress={() => router.push('/device-check')} />
    </View>
  </ScrollView></SafeAreaView>;
}
