import { Alert } from 'react-native';
export function confirmAction(title: string, message: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (approved: boolean) => {
      if (settled) return;
      settled = true; signal?.removeEventListener('abort', cancel); resolve(approved);
    };
    const cancel = () => finish(false);
    if (signal?.aborted) { finish(false); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Continue', onPress: () => finish(true) },
    ], { cancelable: true, onDismiss: cancel });
  });
}
