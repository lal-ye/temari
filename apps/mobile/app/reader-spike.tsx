import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ReaderAssetSpikeDOM from '../components/ReaderAssetSpikeDOM';
import fixture from '../../../fixtures/mobile/reader-kitchen-sink.json';
import {
  createExplainSessionHandler,
  type ExplainSessionHandler,
  type ExplainSessionState,
} from '../../../src/reader-core/session/createExplainSessionHandler';
import type { ExplainRequest } from '../../../src/reader-core/bridge';

/**
 * Checkpoint B reader screen: wiring only (plan §8.3). The single-active
 * control flow lives in the pure `createExplainSessionHandler` factory, where
 * the §9 call-count rows test it in web vitest — no RN harness at B.
 */

/** Mock at checkpoint B: latency plus canned text, no credentials/network/AI. */
async function mockExplain(request: ExplainRequest): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return `MOCK · checkpoint B — “${request.term}”: ${request.context.slice(0, 120)}`;
}

export default function ReaderSpikeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<ExplainSessionState>({ kind: 'idle' });

  // Mounted-state guard. Set to true during setup as well: React Strict Mode's
  // setup/cleanup/setup cycle would otherwise leave it false after remount.
  // (Phase 4.3 consolidates this into ONE useFocusEffect.)
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // The session is created once; its deps read refs and the stable setState —
  // never session state — so the DOM action prop identity never changes and
  // nothing re-serializes across the bridge (plan §8.2).
  const sessionRef = useRef<ExplainSessionHandler | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createExplainSessionHandler({
      expectedNoteId: fixture.id,
      isAlive: () => aliveRef.current,
      isFocused: () => true, // Phase 4.3: useFocusEffect drives this
      dispatch: setPanel,
      run: mockExplain,
    });
  }

  // Stable bridge actions: empty deps, reading refs only (plan §8.2).
  const onExplain = useCallback(async (raw: unknown) => {
    await sessionRef.current?.submit(raw);
  }, []);
  const closePanel = useCallback(() => {
    sessionRef.current?.invalidate();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to hello" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Offline reader · checkpoint B</Text>
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
      {panel.kind !== 'idle' && (
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
          <Text style={styles.panelEyebrow}>{panel.kind === 'done' ? 'MOCK · CHECKPOINT B' : panel.kind === 'pending' ? 'MOCK · RUNNING' : 'REQUEST REJECTED'}</Text>
          {panel.kind === 'pending' && (
            <>
              <Text style={styles.panelTerm}>{panel.request.term}</Text>
              <Text style={styles.panelBody}>Running the mock explanation… (no network, no AI at checkpoint B)</Text>
            </>
          )}
          {panel.kind === 'done' && (
            <>
              <Text style={styles.panelTerm}>{panel.request.term}</Text>
              <Text style={styles.panelBody}>{panel.result}</Text>
              <Text style={styles.panelMeta}>requestId {panel.request.requestId}</Text>
            </>
          )}
          {panel.kind === 'error' && (
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
