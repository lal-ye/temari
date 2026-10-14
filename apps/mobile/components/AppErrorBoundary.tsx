import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button, ui } from './Screen';
import { diagnosticReport, recordDiagnostic } from '@/src/diagnostics';
import { shareText } from '@/src/platform/files';
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; exportFailed: boolean }> {
  state = { failed: false, exportFailed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { recordDiagnostic('render', 'unexpected'); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={[ui.screen, ui.content, { justifyContent: 'center' }]}>
      <Text style={ui.title}>This screen could not open</Text>
      <Text style={ui.body}>Your saved library has not been cleared. Retry the screen or restart Temari.</Text>
      <Button title="Retry screen" onPress={() => this.setState({ failed: false })} />
      <Button title="Export diagnostic report" onPress={() => void shareText('temari-diagnostics.json', diagnosticReport()).catch(() => this.setState({ exportFailed: true }))} />
      {this.state.exportFailed && <Text style={ui.error}>Could not export the report. Try again after restarting.</Text>}
    </View>;
  }
}
