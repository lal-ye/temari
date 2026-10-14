import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { validatePdf } from '@temari/core';
import { Screen, Button, ui } from '@/components/Screen';
import { pickStudyFile, shareText } from '@/src/platform/files';
import { aiClient } from '@/src/ai/client';
import { phaseText, useAiOperation } from '@/src/ai/useAiOperation';

type Pdf = { name: string; size: number; content: string };
export default function PdfScreen() {
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [picking, setPicking] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const ai = useAiOperation('pdf');
  useFocusEffect(useCallback(() => { alive.current = true; return () => { alive.current = false; setPdf(null); }; }, []));
  async function pick() {
    if (busy.current || ai.phase) return;
    busy.current = true; setPicking(true); setMessage('');
    try {
      const file = await pickStudyFile('pdf');
      if (!alive.current || !file) return;
      validatePdf(file.content, file.size);
      setPdf(file); setText('');
    } catch { if (alive.current) setMessage('Choose a readable PDF up to 1 MiB. No data was sent.'); }
    finally { busy.current = false; if (alive.current) setPicking(false); }
  }
  return <Screen title="PDF → Material">
    <Text style={ui.body}>A small-PDF extraction experiment. Choose a text-based PDF up to 1 MiB. Picking a file does not upload it; temporary file copies are deleted after reading.</Text>
    <Button title={picking ? 'Reading PDF…' : 'Choose a PDF'} disabled={picking || !!ai.phase} onPress={() => void pick()} />
    {pdf && <>
      <Text style={ui.label}>{pdf.name} · {Math.ceil(pdf.size / 1024)} KiB</Text>
      <Text style={ui.body}>Send this entire PDF to Google Gemini using your saved key? This is AI transcription, not a local PDF parser. Provider charges may apply. Check the extracted text against your original.</Text>
      <View style={ui.row}>
        <Button title="Send PDF and extract" disabled={!!ai.phase} onPress={() => void ai.run((options) => aiClient.extractPdf(pdf.content, pdf.size, options), (value) => { setText(value); setPdf(null); })} />
        <Button title="Discard PDF" disabled={!!ai.phase} onPress={() => setPdf(null)} />
      </View>
    </>}
    {ai.phase && <><Text accessibilityLiveRegion="polite" style={ui.body}>{phaseText[ai.phase]}</Text><Button title="Cancel extraction" onPress={() => { ai.cancel(); setMessage('Cancelled locally. An uploaded request may still incur a charge. Nothing was saved.'); }} /></>}
    {!!ai.error && <Text accessibilityRole="alert" style={ui.error}>{ai.error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
    {!!text && <>
      <Text style={ui.label}>GEMINI TRANSCRIPTION · REVIEW BEFORE USE</Text>
      <TextInput accessibilityLabel="Extracted Material" multiline style={[ui.input, { minHeight: 280, textAlignVertical: 'top' }]} value={text} onChangeText={setText} />
      <Button title="Export Material as text" onPress={() => void shareText('temari-material.txt', text, 'text/plain').catch(() => setMessage('Could not export Material. Try again.'))} />
    </>}
  </Screen>;
}
