import { useCallback, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { aiErrorMessage, getProviderInfo } from '@temari/core';
import { Screen, Button, ui } from '@/components/Screen';
import { readKey, saveKey, deleteKey } from '@/src/settings/credentials';
import { readModel, saveModel } from '@/src/settings/preferences';
import { aiClient } from '@/src/ai/client';
import { phaseText, useAiOperation } from '@/src/ai/useAiOperation';
import { diagnosticReport, recordDiagnostic } from '@/src/diagnostics';
import { shareText } from '@/src/platform/files';

export default function SettingsScreen() {
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [model, setModel] = useState(getProviderInfo('gemini').defaultModel);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const ai = useAiOperation('connection');
  useFocusEffect(useCallback(() => {
    alive.current = true;
    Promise.all([readKey(), readModel()]).then(([storedKey, storedModel]) => {
      if (alive.current) { setHasKey(Boolean(storedKey)); setModel(storedModel); }
    }).catch(() => { if (alive.current) setStatus('Settings could not be read. Retry by reopening this screen.'); });
    return () => { alive.current = false; setKey(''); };
  }, []));
  async function change(action: () => Promise<void>, message: string) {
    if (busy.current || ai.phase) return;
    busy.current = true; setSaving(true);
    try {
      await action();
      const stored = await readKey();
      if (alive.current) { setHasKey(Boolean(stored)); setKey(''); setStatus(message); }
    } catch (error) {
      recordDiagnostic('settings', 'storage');
      if (alive.current) setStatus(aiErrorMessage(error));
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  return <Screen title="Settings">
    <Text style={ui.label}>GEMINI · BRING YOUR OWN KEY</Text>
    <Text style={ui.body}>{Platform.OS === 'web'
      ? 'Your key stays in this tab’s memory only. Reloading clears it. Use a trusted browser; scripts and extensions can access browser memory.'
      : 'Your key is encrypted at rest with Android SecureStore, excluded from Android backups. Uninstalling removes it; a rooted or compromised device is not protected.'}</Text>
    <Text style={ui.body}>Keys never enter the Note reader or portable exports. Study data stays local. Only a confirmed AI action sends selected text or a PDF directly to Google. Provider charges may apply.</Text>
    <Text style={ui.label}>{hasKey ? 'KEY SAVED · ENTER A NEW KEY TO ROTATE' : 'NO KEY SAVED'}</Text>
    <TextInput accessibilityLabel="Gemini API key" style={ui.input} value={key} onChangeText={setKey} placeholder="Gemini API key" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={1024} editable={!saving && !ai.phase} />
    <View style={ui.row}>
      <Button title="Save key" disabled={!key.trim() || saving || !!ai.phase} onPress={() => void change(() => saveKey(key), 'Key saved. Test the connection below.')} />
      <Button title="Delete key" disabled={!hasKey || saving || !!ai.phase} onPress={() => void change(deleteKey, 'Key deleted. Saved study data is unchanged.')} />
    </View>
    <Text style={ui.label}>MODEL ID</Text>
    <TextInput accessibilityLabel="Gemini model ID" style={ui.input} value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} maxLength={120} />
    <Button title="Save model" disabled={!/^[a-zA-Z0-9._-]{1,120}$/.test(model) || saving || !!ai.phase} onPress={() => void change(() => saveModel(model), 'Model saved.')} />
    <Text style={ui.body}>The connection test checks access to the saved model without generating content. It does not prove available generation quota. No requests run at startup.</Text>
    <Button title="Test connection" disabled={!hasKey || saving || !!ai.phase} onPress={() => { setStatus(''); void ai.run((options) => aiClient.checkConnection(options), () => setStatus('Connected to the saved model. Generation quota has not been tested.')); }} />
    {ai.phase && <><Text accessibilityLiveRegion="polite" style={ui.body}>{phaseText[ai.phase]}</Text><Button title="Cancel connection" onPress={ai.cancel} /></>}
    {!!ai.error && <Text accessibilityRole="alert" style={ui.error}>{ai.error}</Text>}
    {!!status && <Text accessibilityLiveRegion="polite" style={ui.body}>{status}</Text>}
    <Text style={ui.label}>DIAGNOSTICS</Text>
    <Text style={ui.body}>Export app/build information and the last 50 operation categories from this app session. No keys, study text, file names, URLs or raw error messages.</Text>
    <Button title="Export diagnostic report" onPress={() => void shareText('temari-diagnostics.json', diagnosticReport()).catch(() => setStatus('Could not export diagnostics. Please retry.'))} />
  </Screen>;
}
