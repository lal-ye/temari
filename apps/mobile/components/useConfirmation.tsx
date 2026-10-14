import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button, ui } from './Screen';
/** One app-owned confirmation on both platforms. Browser window.confirm is
 * suppressed in cross-origin embeds, including hosted previews. */
export function useConfirmation() {
  const pending = useRef<((answer: boolean) => void) | null>(null);
  const [question, setQuestion] = useState<{ title: string; message: string; approve: string } | null>(null);
  const dismiss = useCallback(() => pending.current?.(false), []);
  useEffect(() => dismiss, [dismiss]);
  const confirm = useCallback((title: string, message: string, signal?: AbortSignal, approve = 'Continue'): Promise<boolean> => {
    if (pending.current || signal?.aborted) return Promise.resolve(false);
    return new Promise(resolve => {
      const finish = (answer: boolean) => {
        if (pending.current !== finish) return;
        pending.current = null;
        signal?.removeEventListener('abort', cancel);
        setQuestion(null); resolve(answer);
      };
      const cancel = () => finish(false);
      pending.current = finish;
      signal?.addEventListener('abort', cancel, { once: true });
      setQuestion({ title, message, approve });
    });
  }, []);
  const dialog = <Modal visible={question !== null} transparent animationType="none" onRequestClose={dismiss}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0009', padding: 24 }}>
      <View accessibilityViewIsModal style={{ backgroundColor: '#f7f4ed', padding: 24, borderRadius: 12, gap: 18, maxWidth: 560, width: '100%' }}>
        <Text accessibilityRole="header" style={ui.title}>{question?.title}</Text>
        <Text style={ui.body}>{question?.message}</Text>
        <View style={ui.row}>
          <Button title="Cancel" onPress={dismiss} />
          <Button title={question?.approve ?? 'Continue'} onPress={() => pending.current?.(true)} />
        </View>
      </View>
    </View>
  </Modal>;
  return { confirm, dismiss, dialog };
}
