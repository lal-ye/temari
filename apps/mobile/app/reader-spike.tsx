import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ReaderAssetSpikeDOM from '../components/ReaderAssetSpikeDOM';
import fixture from '../../../fixtures/mobile/reader-kitchen-sink.json';
import { validateExplainRequest, type ExplainRequest } from '../../../src/reader-core/bridge';

/** Native result panel state (checkpoint B: mock results only). */
type PanelState =
  | { kind: 'done'; request: ExplainRequest; text: string }
  | { kind: 'error'; reason: string }
  | null;

export default function ReaderSpikeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<PanelState>(null);

  // Mounted-state guard. Set to true during setup as well: React Strict Mode's
  // setup/cleanup/setup cycle would otherwise leave it false after remount.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Single active request at a time (check-and-set BEFORE starting the mock).
  // While pending, further submissions are absorbed — even with another id.
  // There is no supersede and no request-id history at checkpoint B.
  const activeRequestIdRef = useRef<string | null>(null);

  const onExplain = useCallback(async (raw: unknown) => {
    if (activeRequestIdRef.current !== null) return;
    const checked = validateExplainRequest(fixture.id, raw);
    if (!checked.ok) {
      if (aliveRef.current) setPanel({ kind: 'error', reason: checked.reason });
      return;
    }
    const request = checked.request;
    activeRequestIdRef.current = request.requestId;
    try {
      // Mock latency only. No credentials, no network, no AI at checkpoint B.
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!aliveRef.current || activeRequestIdRef.current !== request.requestId) return;
      setPanel({
        kind: 'done',
        request,
        text: `MOCK · checkpoint B — “${request.term}”: ${request.context.slice(0, 120)}`,
      });
    } catch {
      if (aliveRef.current && activeRequestIdRef.current === request.requestId) {
        setPanel({ kind: 'error', reason: 'mock-failed' });
      }
    } finally {
      if (activeRequestIdRef.current === request.requestId) activeRequestIdRef.current = null;
    }
  }, []);

  const closePanel = useCallback(() => {
    // Invalidate any pending request: a late completion must not reopen the panel.
    activeRequestIdRef.current = null;
    setPanel(null);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to hello" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Offline reader · asset spike</Text>
      </View>
      <ReaderAssetSpikeDOM
        title={fixture.title}
        content={fixture.content}
        noteId={fixture.id}
        onExplain={onExplain}
        dom={{
          style: { flex: 1 },
          // No general-purpose native-module access from the DOM context.
          unstable_useExpoModulesBridge: false,
        }}
      />
      {panel && (
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
          <Text style={styles.panelEyebrow}>{panel.kind === 'done' ? 'MOCK · CHECKPOINT B' : 'REQUEST REJECTED'}</Text>
          {panel.kind === 'done' ? (
            <>
              <Text style={styles.panelTerm}>{panel.request.term}</Text>
              <Text style={styles.panelBody}>{panel.text}</Text>
              <Text style={styles.panelMeta}>requestId {panel.request.requestId}</Text>
            </>
          ) : (
            <Text style={styles.panelBody}>The mock action did not start: {panel.reason}.</Text>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Close result panel" onPress={closePanel} style={styles.panelClose}>
            <Text style={styles.panelCloseText}>Close</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f4ed' },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#d4d4c5', paddingHorizontal: 12, paddingVertical: 4, gap: 12 },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#2457a5', fontSize: 16, fontWeight: '600' },
  title: { flexShrink: 1, fontSize: 15, color: '#242722', fontWeight: '600' },
  // Bottom card, sibling of the reader — not a Modal (no modal Back behavior at B).
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#1d2433', borderTopWidth: 2, borderTopColor: '#2457a5',
    paddingHorizontal: 16, paddingTop: 14, gap: 6,
  },
  panelEyebrow: { color: '#f0b429', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  panelTerm: { color: '#fffaf0', fontSize: 17, fontWeight: '700' },
  panelBody: { color: '#d9e2f1', fontSize: 14, lineHeight: 20 },
  panelMeta: { color: '#8b98ad', fontSize: 11, fontVariant: ['tabular-nums'] },
  panelClose: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, marginTop: 4 },
  panelCloseText: { color: '#9db8e8', fontSize: 15, fontWeight: '600' },
});
