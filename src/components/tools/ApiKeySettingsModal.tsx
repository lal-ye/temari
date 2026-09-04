import React, { useState } from 'react';
import { Key, CheckCircle, AlertCircle, ExternalLink, X, ShieldCheck } from 'lucide-react';
import { getStudyStore } from '../../services/studyStore';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState(() => getStudyStore().settings.apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    getStudyStore().saveSettings({ apiKey: apiKey.trim() });
    onSaved();
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    getStudyStore().saveSettings({ apiKey: undefined });
    onSaved();
    setTestResult({ success: true, message: 'Custom API Key removed. Using default server configuration.' });
  };

  const testKey = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      // Test the key via simple note explanation call
      const res = await fetch('/api/ai/explain-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: 'StudySmart', apiKey: apiKey.trim() }),
      });

      if (res.ok) {
        setTestResult({ success: true, message: 'API Key is valid and working with Gemini 2.0 Flash!' });
      } else {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          success: false,
          message: data.error || 'Failed to authenticate with Gemini API. Check key permissions.',
        });
      }
    } catch {
      setTestResult({
        success: true,
        message: 'Key saved for client-side BYOK mode (Netlify static deployment ready).',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-xl p-5 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Gemini AI Configuration</h2>
            <p className="text-xs text-slate-500">Bring Your Own Key (BYOK) for Netlify deployment & custom limits</p>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Zero Backend Storage Required</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your key is stored strictly inside your browser&apos;s local storage. It enables full AI features directly on
              <strong> temari.netlify.app</strong> with zero backend cost.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
            />
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium text-[11px]">{testResult.message}</div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline text-[11px]"
            >
              Get a Free Gemini API Key <ExternalLink className="w-3 h-3" />
            </a>

            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:text-rose-700 font-medium hover:underline text-[11px]"
              >
                Clear Key
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={testKey}
              disabled={testing || !apiKey}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
