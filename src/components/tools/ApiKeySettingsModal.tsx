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
} from 'lucide-react';
import { getStudyStore } from '../../services/studyStore';
import {
  AIProvider,
  AVAILABLE_PROVIDERS,
  getProviderConfig,
  getModelOption,
  getActiveModelForProvider,
} from '../../types';
import { ModelPicker } from './ModelPicker';
import { AIService } from '../../services/aiService';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
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
  } | null>(null);

  // Sync state when modal is opened
  useEffect(() => {
    if (isOpen) {
      const s = store.settings;
      const prov = s.selectedProvider || 'gemini';
      setSelectedProvider(prov);
      setSelectedModel(getActiveModelForProvider(s, prov));
      setProviderKeys(s.providerKeys || (s.apiKey ? { gemini: s.apiKey } : {}));
      setCustomBaseUrl(s.customBaseUrl || 'http://localhost:11434/v1');
      setCustomModelName(s.customModelName || 'llama3.2');
      setTestResult(null);
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
      const res = await AIService.testConnection({
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
          message: res.error || 'Connection failed. Check provider credentials, model name, or network CORS/endpoint.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error executing test request.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-lg relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-900 hover:bg-yellow-300 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm active:translate-y-0.5"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-[#FEF08A] text-slate-950 rounded-xl border-2 border-slate-900 shadow-neo-sm">
            <Cpu className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                Model-Agnostic AI Architecture
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md">
                Multi-Provider
              </span>
            </div>
            <p className="text-xs font-bold text-slate-600 mt-0.5">
              Switch between Google Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter, or Local Ollama
            </p>
          </div>
        </div>

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
                  3. {activeProviderConfig.name} Configuration
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                {selectedProvider === 'gemini'
                  ? 'Built-in Container Key Active'
                  : selectedProvider === 'custom'
                  ? 'Local Engine'
                  : 'BYOK (Bring Your Own Key)'}
              </span>
            </div>

            {/* If Custom / Local (Ollama / LM Studio) */}
            {selectedProvider === 'custom' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase mb-1">
                    API Base URL (OpenAI-compatible)
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
                    Model Identifier
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
                    Optional Bearer API Key
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
                    ? 'A default Gemini 2.5 Flash server key is bundled with this deployment. You can optionally enter your personal Google AI Studio key to bypass limits.'
                    : `Enter your API key for ${activeProviderConfig.name}. The key is stored securely in your browser's private store and never logged on public servers.`}
                </p>

                <input
                  type="password"
                  value={currentKeyForProvider}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder={
                    selectedProvider === 'gemini'
                      ? 'AIzaSy... (Optional, leave blank to use container key)'
                      : selectedProvider === 'openai'
                      ? 'sk-proj-... (OpenAI API key)'
                      : selectedProvider === 'anthropic'
                      ? 'sk-ant-... (Anthropic API key)'
                      : selectedProvider === 'groq'
                      ? 'gsk_... (Groq Cloud API key)'
                      : selectedProvider === 'deepseek'
                      ? 'sk-... (DeepSeek API key)'
                      : 'sk-or-... (OpenRouter API key)'
                  }
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-yellow-400"
                />

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

          {/* Test Status Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border-2 text-xs flex items-start gap-2 shadow-neo-sm ${
                testResult.success
                  ? 'bg-emerald-50 border-slate-900 text-emerald-950'
                  : 'bg-rose-50 border-slate-900 text-rose-950'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-bold text-[11px]">{testResult.message}</div>
                {testResult.sampleReply && (
                  <div className="p-2 bg-white/80 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-700">
                    Model response: "{testResult.sampleReply.slice(0, 150)}..."
                  </div>
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
                  Pinging Model...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  Test Active Provider & Model
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
                Save & Apply Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
