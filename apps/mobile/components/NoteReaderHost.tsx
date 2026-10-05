import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import ReaderAssetSpikeDOM from './ReaderAssetSpikeDOM';
import {
  createExplainSessionHandler,
  type ExplainSessionHandler,
  type ExplainSessionState,
} from '@temari/reader-core/session/createExplainSessionHandler';
import {
  createOpenLinkHandler,
  type OpenLinkEvent,
  type OpenLinkHandler,
} from '@temari/reader-core/session/createOpenLinkHandler';
import type { ExplainRequest } from '@temari/reader-core/bridge';

/**
 * Library-backed reader host (M3 plan §9): the same 'use dom' seam
 * (`ReaderAssetSpikeDOM.tsx`, unchanged) and the same single-active session
 * wiring as the checkpoint-B spike, fed real library data instead of the
 * bundled kitchen-sink fixture. No `legacyFigure` prop is passed, so pre-JSON
 * diagram fences render as the labelled source fallback (D2) — the
 * portable-legacy-diagram fixture proves it on device.
 */

/** Mock until M4: latency plus canned text, no credentials/network/AI. */
async function mockExplain(request: ExplainRequest): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return `MOCK · no AI in this milestone — “${request.term}”: ${request.context.slice(0, 120)}`;
}

/** The parsed host, shown prominently; the full URL truncated below. */
function linkHost(url: string): string {
  const match = /^https:\/\/[^/?#]+/i.exec(url);
  return match ? match[0].slice('https://'.length) : url;
}

/**
 * The ONE confirmation, native (the checkpoint-B rule): `Alert.alert` —
 * native, accessible, modal, free. Confirming hands the URL to the operating
 * system outside the reader. Never `canOpenURL`: on Android 11+ it returns
 * false negatives without package-visibility entries.
 */
function confirmOpenLink(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const truncated = url.length > 96 ? `${url.slice(0, 96)}…` : url;
    Alert.alert(
      'Open this link outside Temari?',
      `${linkHost(url)}\n${truncated}\n\nTemari hands the link to another app on your device.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Open', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function NoteReaderHost({
  title,
  content,
  noteId,
}: {
  title: string;
  content: string;
  noteId: string;
}) {
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<ExplainSessionState>({ kind: 'idle' });
  const [linkPanel, setLinkPanel] = useState<OpenLinkEvent>({ kind: 'idle' });

  // ONE lifecycle mechanism (the M2 rule): useFocusEffect covers focus/blur
  // AND mount/unmount, and its setup/cleanup behaves under Strict Mode
  // re-runs. The factories are the single place invalidation lands.
  const aliveRef = useRef(true);
  const focusedRef = useRef(true);

  // The sessions are created once; their deps read refs and stable setState —
  // never session state — so the DOM action props never change identity and
  // nothing re-serializes across the bridge.
  const explainRef = useRef<ExplainSessionHandler | null>(null);
  if (explainRef.current === null) {
    explainRef.current = createExplainSessionHandler({
      expectedNoteId: noteId,
      isAlive: () => aliveRef.current,
      isFocused: () => focusedRef.current,
      dispatch: setPanel,
      run: mockExplain,
    });
  }
  const linkRef = useRef<OpenLinkHandler | null>(null);
  if (linkRef.current === null) {
    linkRef.current = createOpenLinkHandler({
      confirm: confirmOpenLink,
      open: (url) => Linking.openURL(url),
      dispatch: setLinkPanel,
    });
  }

  useFocusEffect(
    useCallback(() => {
      aliveRef.current = true;
      focusedRef.current = true;
      return () => {
        // Blur and unmount both land here: pending work is invalidated (a
        // late completion must not reopen anything) and the guards clear, so
        // a fresh submission always works afterwards.
        aliveRef.current = false;
        focusedRef.current = false;
        explainRef.current?.invalidate();
        linkRef.current?.invalidate();
      };
    }, []),
  );

  // Stable bridge actions: empty deps, reading refs only.
  const onExplain = useCallback(async (raw: unknown) => {
    await explainRef.current?.submit(raw);
  }, []);
  const onOpenLink = useCallback(async (raw: unknown) => {
    await linkRef.current?.submit(raw);
  }, []);
  const closePanel = useCallback(() => {
    explainRef.current?.invalidate();
    linkRef.current?.invalidate();
  }, []);

  return (
    <View style={styles.host}>
      <ReaderAssetSpikeDOM
        title={title}
        content={content}
        noteId={noteId}
        onExplain={onExplain}
        onOpenLink={onOpenLink}
        dom={{
          style: { flex: 1 },
          // No general-purpose native-module access from the DOM context.
          unstable_useExpoModulesBridge: false,
        }}
      />
      {(panel.kind !== 'idle' || linkPanel.kind !== 'idle') && (
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
          {panel.kind !== 'idle' ? (
            <>
              <Text style={styles.panelEyebrow}>{panel.kind === 'done' ? 'MOCK EXPLANATION' : panel.kind === 'pending' ? 'MOCK · RUNNING' : 'REQUEST REJECTED'}</Text>
              {panel.kind === 'pending' && (
                <>
                  <Text style={styles.panelTerm}>{panel.request.term}</Text>
                  <Text style={styles.panelBody}>Running the mock explanation… (no network, no AI in this milestone)</Text>
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
            </>
          ) : (
            <>
              <Text style={styles.panelEyebrow}>LINK HANDOFF</Text>
              {linkPanel.kind === 'opened' && (
                <Text style={styles.panelBody}>Opened {linkHost(linkPanel.url)} outside Temari.</Text>
              )}
              {linkPanel.kind === 'rejected' && (
                <Text style={styles.panelBody}>Link blocked: not an approved HTTPS address.</Text>
              )}
              {linkPanel.kind === 'failed' && (
                <Text style={styles.panelBody}>No app could open that link.</Text>
              )}
            </>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Close result panel" onPress={closePanel} style={styles.panelClose}>
            <Text style={styles.panelCloseText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  // Bottom card, sibling of the reader — not a Modal (no modal Back behavior).
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
