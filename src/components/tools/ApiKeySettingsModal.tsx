import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  X,
  Sparkles,
  Zap,
  Server,
  Cpu,
  Globe,
  Brain,
  RotateCw,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getStudyStore } from '../../services/studyStore';
import { AIProvider } from '../../types';
import { AVAILABLE_PROVIDERS, getProviderConfig, getModelOption } from './modelPresentation';
import { resolveActiveModel, findRetiredModelReplacement } from '../../../shared/aiCatalog';
import { diagnoseConnectionError, type Diagnosis } from '../../services/ai/diagnoseError';
import { ModelPicker } from './ModelPicker';
import { aiConnection } from '../../services/aiConnection';
import { Modal, type MorphOrigin } from '../ui/Modal';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Control that opened this dialog, so it can morph out of it. */
  originRef?: React.RefObject<MorphOrigin | null>;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  originRef,
}) => {
  const store = getStudyStore();
  const currentSettings = store.settings;

  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    () => currentSettings.selectedProvider || 'gemini'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    () => currentSettings.selectedModel || 'gemini-2.5-flash'
  );
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(
    () => currentSettings.providerKeys || {}
  );
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(
    () => currentSettings.customBaseUrl || 'http://localhost:11434/v1'
  );
  const [customModelName, setCustomModelName] = useState<string>(
    () => currentSettings.customModelName || 'llama3.2'
  );

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    sampleReply?: string;
    /** Present only on failure: what went wrong and what to do. */
    diagnosis?: Diagnosis;
  } | null>(null);
  /** Keys are write-once in the UI; revealing is deliberate, not the default. */
  const [showKey, setShowKey] = useState(false);

  /**
   * A model the learner previously chose that the provider has since retired.
   * Surfaced as an offer to switch rather than migrated silently - they picked
   * that model on purpose and deserve to know it is gone.
   */
  const retiredReplacement = findRetiredModelReplacement(selectedProvider, selectedModel);

  // Sync state when modal is opened
  useEffect(() => {
    if (isOpen) {
      const s = store.settings;
      const prov = s.selectedProvider || 'gemini';
      setSelectedProvider(prov);
      setSelectedModel(resolveActiveModel(s, prov));
      setProviderKeys(s.providerKeys || (s.apiKey ? { gemini: s.apiKey } : {}));
      setCustomBaseUrl(s.customBaseUrl || 'http://localhost:11434/v1');
      setCustomModelName(s.customModelName || 'llama3.2');
      setTestResult(null);
      setShowKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeProviderConfig = getProviderConfig(selectedProvider);
  const activeModelOption = getModelOption(selectedProvider, selectedModel);
  const currentKeyForProvider =
    providerKeys[selectedProvider] || (selectedProvider === 'gemini' ? currentSettings.apiKey || '' : '');

  const handleKeyChange = (val: string) => {
    setProviderKeys((prev) => ({
      ...prev,
      [selectedProvider]: val,
    }));
  };

  const handleClearCurrentKey = () => {
    setProviderKeys((prev) => {
      const next = { ...prev };
      delete next[selectedProvider];
      return next;
    });
    if (selectedProvider === 'gemini') {
      store.saveSettings({ apiKey: undefined });
    }
    setTestResult({
      success: true,
      message: `Key removed for ${activeProviderConfig.name}.`,
    });
  };

  const handleSave = () => {
    const finalModel = selectedProvider === 'custom' ? customModelName.trim() || 'llama3.2' : selectedModel;

    store.saveSettings({
      selectedProvider,
      selectedModel: finalModel,
      providerModels: {
        ...(currentSettings.providerModels || {}),
        [selectedProvider]: finalModel,
      },
      providerKeys,
      apiKey: providerKeys.gemini || undefined,
      customBaseUrl: customBaseUrl.trim() || undefined,
      customModelName: customModelName.trim() || undefined,
    });

    onSaved();
    onClose();
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const keyToTest = providerKeys[selectedProvider]?.trim() || (selectedProvider === 'gemini' ? currentSettings.apiKey : undefined);
    const modelToTest = selectedProvider === 'custom' ? customModelName.trim() || 'llama3.2' : selectedModel;
    const urlToTest = selectedProvider === 'custom' ? customBaseUrl.trim() : undefined;

    try {
      const res = await aiConnection.testConnection({
        provider: selectedProvider,
        model: modelToTest,
        apiKey: keyToTest,
        baseUrl: urlToTest,
      });

      if (res.success) {
        setTestResult({
          success: true,
          latencyMs: res.latencyMs,
          message: `Connection successful (${res.latencyMs}ms)! Connected to ${res.providerUsed || selectedProvider} / ${res.modelUsed || modelToTest}.`,
          sampleReply: res.reply,
        });
      } else {
        setTestResult({
          success: false,
          latencyMs: res.latencyMs,
          message: res.error || 'Connection failed.',
          diagnosis: diagnoseConnectionError({
            message: res.error || '',
            provider: selectedProvider,
            hasKey: Boolean(keyToTest),
            isLocal: selectedProvider === 'custom',
            baseUrl: urlToTest,
          }),
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error executing test request.',
        diagnosis: diagnoseConnectionError({
          message: err?.message || '',
          provider: selectedProvider,
          hasKey: Boolean(keyToTest),
          isLocal: selectedProvider === 'custom',
          baseUrl: urlToTest,
        }),
      });
    } finally {
      setTesting(false);
    }
  };

  const getKeyHelpLink = () => {
    switch (selectedProvider) {
      case 'gemini':
        return { text: 'Get free Gemini API Key', url: 'https://aistudio.google.com/app/apikey' };
      case 'openai':
        return { text: 'Get OpenAI API Key', url: 'https://platform.openai.com/api-keys' };
      case 'anthropic':
        return { text: 'Get Claude API Key', url: 'https://console.anthropic.com/settings/keys' };
      case 'groq':
        return { text: 'Get free Groq API Key (ultra-fast)', url: 'https://console.groq.com/keys' };
      case 'deepseek':
        return { text: 'Get DeepSeek API Key', url: 'https://platform.deepseek.com/api_keys' };
      case 'openrouter':
        return { text: 'Get OpenRouter API Key (unified 200+ models)', url: 'https://openrouter.ai/keys' };
      default:
        return null;
    }
  };

  const helpLink = getKeyHelpLink();

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="AI provider and model"
      subtitle="Choose who generates your notes, and with which model"
      icon={<Cpu className="w-5 h-5 text-slate-900" />}
      iconClassName="bg-[#FEF08A] text-slate-950"
      maxWidthClassName="max-w-2xl"
      originRef={originRef}
    >
      <div className="space-y-4">
        {/* Detailed Provider and Model Picker */}
          <div className="bg-[#FAF8F5] border-2 border-slate-900 rounded-xl p-3.5 shadow-neo-sm">
            <ModelPicker
              variant="detailed"
              onModelChanged={(providerId, modelId) => {
                setSelectedProvider(providerId);
                setSelectedModel(modelId);
              }}
            />
          </div>

          {/* Provider Specific Configuration & Credentials */}
          <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-neo-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {activeProviderConfig.name} key
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                {selectedProvider === 'gemini'
                  ? 'Server key available'
                  : selectedProvider === 'custom'
                  ? 'Runs locally'
                  : 'Your own key'}
              </span>
            </div>

            {/* If Custom / Local (Ollama / LM Studio) */}
            {selectedProvider === 'custom' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
Base URL
                  </label>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-yellow-400"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold text-slate-500">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setCustomBaseUrl('http://localhost:11434/v1')}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800"
                    >
                      Ollama (:11434)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomBaseUrl('http://localhost:1234/v1')}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800"
                    >
                      LM Studio (:1234)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomBaseUrl('http://localhost:8000/v1')}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800"
                    >
                      vLLM (:8000)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
Model name
                  </label>
                  <input
                    type="text"
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    placeholder="llama3.2, mistral, qwen2.5:7b, deepseek-r1:8b"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-yellow-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
API key (optional for local)
                  </label>
                  <input
                    type="password"
                    value={currentKeyForProvider}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder="Optional for local instances"
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
            ) : (
              /* Cloud Providers (Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter) */
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  {selectedProvider === 'gemini'
                    ? 'This deployment ships a shared Gemini key, so you can start without one. Add your own to avoid the shared rate limit.'
                    : `Stored in this browser only, and sent to ${activeProviderConfig.name} through Temari's server when you generate.`}
                </p>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={currentKeyForProvider}
                    onChange={(e) => handleKeyChange(e.target.value.trim())}
                    aria-label={`${activeProviderConfig.name} API key`}
                    aria-describedby="key-shape-hint"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={activeProviderConfig.keyPlaceholder}
                    className="w-full pl-3 pr-20 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {/* Confirms a paste landed without revealing the secret. */}
                    {currentKeyForProvider && (
                      <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">
                        {currentKeyForProvider.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded"
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Shape check, done locally. Catches the two mistakes that
                    actually happen - pasting the wrong provider's key, and a
                    truncated copy - before spending a round trip on them. */}
                {currentKeyForProvider && (() => {
                  const expected: Partial<Record<string, { prefix: string; label: string }>> = {
                    openai: { prefix: 'sk-', label: 'sk-...' },
                    anthropic: { prefix: 'sk-ant-', label: 'sk-ant-...' },
                    groq: { prefix: 'gsk_', label: 'gsk_...' },
                    openrouter: { prefix: 'sk-or-', label: 'sk-or-...' },
                    gemini: { prefix: 'AIza', label: 'AIza...' },
                  };
                  const rule = expected[selectedProvider];
                  if (!rule || currentKeyForProvider.startsWith(rule.prefix)) return null;
                  return (
                    <p id="key-shape-hint" className="text-[10px] font-bold text-amber-700">
                      {activeProviderConfig.name} keys usually start with{' '}
                      <span className="font-mono">{rule.label}</span>. This may be a key for a
                      different provider.
                    </p>
                  );
                })()}

                <div className="flex items-center justify-between text-xs pt-0.5">
                  {helpLink ? (
                    <a
                      href={helpLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 font-bold hover:underline text-[11px]"
                    >
                      {helpLink.text} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span />
                  )}

                  {currentKeyForProvider && (
                    <button
                      type="button"
                      onClick={handleClearCurrentKey}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold hover:underline text-[11px]"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear Key for {activeProviderConfig.name.split(' ')[0]}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Retired-model notice. Shown before any test, because the test
              would fail with a 404 that looks like a Temari bug. */}
          {retiredReplacement && (
            <div className="p-3 rounded-xl border-2 border-amber-600 bg-amber-50 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-amber-950">
                  {activeProviderConfig.name} has retired this model
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-amber-900 text-pretty">
                  <span className="font-mono">{selectedModel}</span> no longer accepts requests.
                  Switch to <span className="font-mono">{retiredReplacement}</span> to keep
                  generating.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel(retiredReplacement);
                    setTestResult(null);
                  }}
                  className="btn-kinetic mt-2 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg border-2 border-slate-900 text-[10px] font-black shadow-neo-xs"
                >
                  Use {retiredReplacement}
                </button>
              </div>
            </div>
          )}

          {/* Test result. On failure this leads with the cause and the fix,
              not the provider's raw error string - "fetch failed" is the same
              message for a dead DNS lookup and an Ollama that is not running,
              and neither tells the learner what to do. */}
          {testResult && (
            <div
              role="status"
              aria-live="polite"
              className={`p-3 rounded-xl border-2 border-slate-900 text-xs flex items-start gap-2.5 shadow-neo-sm ${
                testResult.success ? 'bg-emerald-50' : 'bg-rose-50'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              )}

              <div className="flex-1 min-w-0 space-y-1">
                {testResult.success ? (
                  <>
                    <p className="font-black text-[11px] text-emerald-950">
                      Working
                      {testResult.latencyMs !== undefined && (
                        <span className="font-bold tabular-nums"> · replied in {testResult.latencyMs}ms</span>
                      )}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-900">{testResult.message}</p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-[11px] text-rose-950">
                      {testResult.diagnosis?.title ?? 'The connection test failed'}
                    </p>
                    <p className="text-[11px] font-medium text-rose-900 text-pretty">
                      {testResult.diagnosis?.fix}
                    </p>
                    {/* Raw provider text kept available but demoted: useful
                        when searching for the error, noise otherwise. */}
                    {testResult.diagnosis?.kind !== 'unknown' && testResult.message && (
                      <details className="pt-0.5">
                        <summary className="text-[10px] font-black text-rose-800 cursor-pointer">
                          Provider response
                        </summary>
                        <p className="mt-1 p-2 bg-white/70 rounded-lg border border-rose-200 text-[10px] font-mono text-slate-700 break-words">
                          {testResult.message}
                        </p>
                      </details>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="px-3.5 py-2 text-xs font-black text-slate-900 bg-white hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-neo-sm active:translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {testing ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  Test this key
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-black text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-xs font-black text-slate-900 bg-[#FEF08A] hover:bg-yellow-300 rounded-xl border-2 border-slate-900 shadow-neo-sm hover:shadow-neo active:translate-y-0.5 transition-all"
              >
Save
              </button>
            </div>
          </div>
        </div>
      </Modal>
  );
};
