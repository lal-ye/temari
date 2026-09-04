import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ChevronDown,
  Check,
  Zap,
  Brain,
  Settings,
  Server,
  Cpu,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  AVAILABLE_PROVIDERS,
  AIProvider,
  AIModelOption,
  getModelOption,
  getProviderConfig,
  getActiveModelForProvider,
} from '../../types';
import { studyStore, useSettings } from '../../hooks/useStudyStore';
import { AIService } from '../../services/aiService';

interface ModelPickerProps {
  variant?: 'compact' | 'detailed';
  onModelChanged?: (providerId: AIProvider, modelId: string) => void;
  onOpenSettings?: () => void;
  className?: string;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  variant = 'compact',
  onModelChanged,
  onOpenSettings,
  className = '',
}) => {
  const settings = useSettings();
  const activeProviderId: AIProvider = settings.selectedProvider || 'gemini';
  const activeModelId = getActiveModelForProvider(settings, activeProviderId);

  const [selectedProviderTab, setSelectedProviderTab] = useState<AIProvider>(activeProviderId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Programmatic Live Model discovery states
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [liveModels, setLiveModels] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      contextWindow?: number;
      isVisionCapable?: boolean;
    }>
  >([]);
  const [liveScanError, setLiveScanError] = useState<string | null>(null);
  const [customInputId, setCustomInputId] = useState('');
  const [liveSearchFilter, setLiveSearchFilter] = useState('');
  const [showLiveDrawer, setShowLiveDrawer] = useState(false);

  // Sync tab with active provider on mount or change
  useEffect(() => {
    setSelectedProviderTab(activeProviderId);
  }, [activeProviderId]);

  // Reset live models list when changing tab
  useEffect(() => {
    setLiveModels([]);
    setLiveScanError(null);
    setShowLiveDrawer(false);
    setLiveSearchFilter('');
  }, [selectedProviderTab]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentProviderConfig = getProviderConfig(activeProviderId);
  const currentModelOption = getModelOption(activeProviderId, activeModelId);

  const handleSelect = (providerId: AIProvider, modelId: string) => {
    studyStore.saveSettings({
      selectedProvider: providerId,
      selectedModel: modelId,
      providerModels: {
        ...(settings.providerModels || {}),
        [providerId]: modelId,
      },
    });
    if (onModelChanged) {
      onModelChanged(providerId, modelId);
    }
    setIsOpen(false);
  };

  const handleApplyCustomModel = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = customInputId.trim();
    if (!cleanId) return;

    studyStore.saveSettings({
      selectedProvider: selectedProviderTab,
      selectedModel: cleanId,
      providerModels: {
        ...(settings.providerModels || {}),
        [selectedProviderTab]: cleanId,
      },
      customModelName: selectedProviderTab === 'custom' ? cleanId : settings.customModelName,
    });
    if (onModelChanged) {
      onModelChanged(selectedProviderTab, cleanId);
    }
    setCustomInputId('');
  };

  /**
   * Programmatically check live model offerings directly from the provider's API
   */
  const handleScanLiveModels = async () => {
    setIsScanningLive(true);
    setLiveScanError(null);
    setShowLiveDrawer(true);

    try {
      const apiKey =
        settings.providerKeys?.[selectedProviderTab] ||
        (selectedProviderTab === 'gemini' ? settings.apiKey : undefined);
      const baseUrl = selectedProviderTab === 'custom' ? settings.customBaseUrl : undefined;

      const res = await AIService.fetchLiveModels({
        provider: selectedProviderTab,
        apiKey,
        baseUrl,
      });

      if (res.success && res.models && res.models.length > 0) {
        setLiveModels(res.models);
      } else {
        setLiveScanError(res.error || `No live models returned for ${selectedProviderTab}.`);
      }
    } catch (err: any) {
      setLiveScanError(err.message || 'Error communicating with live model discovery service.');
    } finally {
      setIsScanningLive(false);
    }
  };

  const getProviderIcon = (id: AIProvider) => {
    switch (id) {
      case 'gemini':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-600" />;
      case 'openai':
        return <Cpu className="w-3.5 h-3.5 text-slate-800" />;
      case 'anthropic':
        return <Brain className="w-3.5 h-3.5 text-orange-600" />;
      case 'groq':
        return <Zap className="w-3.5 h-3.5 text-red-600" />;
      case 'deepseek':
        return <Cpu className="w-3.5 h-3.5 text-blue-600" />;
      case 'openrouter':
        return <Globe className="w-3.5 h-3.5 text-violet-600" />;
      case 'custom':
        return <Server className="w-3.5 h-3.5 text-amber-700" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  // Check if provider has a key configured
  const hasKeyForProvider = (providerId: AIProvider): boolean => {
    if (providerId === 'gemini') return true; // server default exists
    if (providerId === 'custom') return true; // local doesn't require key
    return !!(settings.providerKeys && settings.providerKeys[providerId]);
  };

  if (variant === 'detailed') {
    const tabProviderConfig = getProviderConfig(selectedProviderTab);
    const filteredLiveModels = liveModels.filter(
      (m) =>
        m.id.toLowerCase().includes(liveSearchFilter.toLowerCase()) ||
        (m.name && m.name.toLowerCase().includes(liveSearchFilter.toLowerCase()))
    );

    const isCurrentModelCustom =
      !tabProviderConfig.models.some((m) => m.id === activeModelId) &&
      activeProviderId === selectedProviderTab;

    return (
      <div className={`space-y-4 ${className}`}>
        {/* Provider Tabs */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              1. Choose AI Provider
            </label>
            <span className="text-[10px] font-bold text-slate-500">
              Active: <strong className="text-slate-900">{currentProviderConfig.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {AVAILABLE_PROVIDERS.map((provider) => {
              const isActive = provider.id === selectedProviderTab;
              const isSavedActive = provider.id === activeProviderId;
              const hasKey = hasKeyForProvider(provider.id);

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderTab(provider.id)}
                  className={`p-2 rounded-xl border-2 text-left transition-all relative flex flex-col gap-0.5 ${
                    isActive
                      ? 'bg-amber-100/90 border-slate-900 shadow-neo-sm ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {getProviderIcon(provider.id)}
                      <span className="text-xs font-black text-slate-900 truncate">
                        {provider.name.split(' ')[0]}
                      </span>
                    </div>
                    {isSavedActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs"
                        title="Currently active"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold mt-0.5">
                    <span className="truncate max-w-[85px]">
                      {provider.id === 'custom' ? 'Local / Self-hosted' : provider.id.toUpperCase()}
                    </span>
                    {hasKey ? (
                      <span className="text-emerald-700 font-black">Ready</span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-0.5 font-bold">
                        <Lock className="w-2.5 h-2.5" /> Key Req
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selection for Active Tab (Curated 2 Options: Flagship & Budget) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              2. Curated Model Options on {tabProviderConfig.name}
            </label>
            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-300 px-2 py-0.5 rounded">
              2 Curated Tiers: Flagship & Cheap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {tabProviderConfig.models.map((model: AIModelOption) => {
              const isSelected =
                activeProviderId === tabProviderConfig.id && activeModelId === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(tabProviderConfig.id, model.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all relative flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-amber-50/90 border-slate-900 shadow-neo-sm ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-black text-slate-900">{model.name}</span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded border whitespace-nowrap ${model.badgeColor}`}
                      >
                        {model.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">{model.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-amber-600" /> {model.speed}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Brain className="w-2.5 h-2.5 text-purple-600" /> {model.reasoning}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-black text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                          <Check className="w-3 h-3 stroke-[3]" /> Active
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[80px]">
                          {model.id}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Custom Model Display if selected */}
          {isCurrentModelCustom && (
            <div className="p-2.5 bg-purple-50 border-2 border-purple-400 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div>
                  <span className="text-xs font-black text-purple-950">Active Custom Model: </span>
                  <span className="font-mono text-xs font-bold text-purple-900">{activeModelId}</span>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase bg-purple-200 text-purple-950 px-2 py-0.5 rounded border border-purple-400">
                Custom Specified
              </span>
            </div>
          )}
        </div>

        {/* Programmatic Live Discovery & Custom Model Feature */}
        <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-700" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Programmatic Live Model Discovery & Custom ID
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Check programmatically what {tabProviderConfig.name}&apos;s live API currently offers, or specify any model ID.
              </p>
            </div>

            <button
              type="button"
              onClick={handleScanLiveModels}
              disabled={isScanningLive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-yellow-200 text-slate-950 text-xs font-black rounded-lg border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningLive ? 'animate-spin' : ''}`} />
              <span>{isScanningLive ? 'Querying API...' : `Query ${tabProviderConfig.name} Live API`}</span>
            </button>
          </div>

          {/* Error Message if Scan Failed */}
          {liveScanError && (
            <div className="p-2.5 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{liveScanError}</p>
                {tabProviderConfig.requiresKey && !hasKeyForProvider(tabProviderConfig.id) && (
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Tip: Enter your API key below in section 3 first, then click query again.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Live Models Discovered Drawer */}
          {showLiveDrawer && liveModels.length > 0 && (
            <div className="bg-white border-2 border-slate-900 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900">
                    Live Verified: {liveModels.length} models discovered on {tabProviderConfig.name} API
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={liveSearchFilter}
                    onChange={(e) => setLiveSearchFilter(e.target.value)}
                    placeholder="Filter live models..."
                    className="pl-7 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded-lg text-slate-900 w-36 sm:w-48 font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100 scrollbar-thin">
                {filteredLiveModels.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2 text-center font-medium">
                    No models match &ldquo;{liveSearchFilter}&rdquo;
                  </p>
                ) : (
                  filteredLiveModels.map((m) => {
                    const isSelected = activeModelId === m.id && activeProviderId === tabProviderConfig.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelect(tabProviderConfig.id, m.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-100 border border-slate-900 font-black'
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-900 truncate">
                              {m.id}
                            </span>
                            {m.isVisionCapable && (
                              <span className="text-[9px] font-black bg-blue-100 text-blue-900 border border-blue-300 px-1 py-0.2 rounded">
                                Vision
                              </span>
                            )}
                            {m.contextWindow && (
                              <span className="text-[9px] font-bold text-slate-500">
                                ({Math.round(m.contextWindow / 1000)}k ctx)
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-[10px] text-slate-500 truncate max-w-sm">
                              {m.description}
                            </p>
                          )}
                        </div>

                        {isSelected ? (
                          <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded transition-all whitespace-nowrap"
                          >
                            Use Model
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Specific Custom Model Input Form */}
          <form onSubmit={handleApplyCustomModel} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customInputId}
              onChange={(e) => setCustomInputId(e.target.value)}
              placeholder={`Specify exact model ID on ${tabProviderConfig.name} (e.g. gemma-4-it, gpt-4.5, claude-3-7-sonnet...)`}
              className="flex-1 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!customInputId.trim()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-black rounded-lg border-2 border-slate-900 transition-all shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Apply ID</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Compact variant (Header / Tutor Bar)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-white text-slate-950 text-xs font-black rounded-xl border-2 border-slate-900 shadow-neo-sm hover:shadow-neo transition-all active:translate-y-0.5"
        title={`AI Model: ${currentProviderConfig.name} - ${currentModelOption.name}`}
        aria-label="Change AI Model and Provider"
      >
        {getProviderIcon(activeProviderId)}
        <span className="hidden sm:inline font-black text-slate-900 truncate max-w-[130px]">
          {currentModelOption.name.replace('Gemini ', '').replace(' (Local Ollama)', '')}
        </span>
        <span className="sm:hidden font-black text-slate-900 text-[11px]">
          {currentProviderConfig.name.split(' ')[0]}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-900 transition-transform stroke-[2.5] ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-3 border-slate-900 rounded-2xl shadow-neo-lg z-50 p-3 space-y-2.5 animate-in fade-in duration-100">
          <div className="px-1 flex items-center justify-between border-b-2 border-slate-100 pb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Model-Agnostic AI Switcher
            </span>
            <span className="text-[9px] font-bold text-slate-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
              7 Providers Supported
            </span>
          </div>

          {/* Quick Provider Horizontal Scroll Chips */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {AVAILABLE_PROVIDERS.map((p) => {
              const isSelected = p.id === selectedProviderTab;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProviderTab(p.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap border transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {p.name.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Models list for selected provider */}
          <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
            {getProviderConfig(selectedProviderTab).models.map((model) => {
              const isSelected =
                activeProviderId === selectedProviderTab && activeModelId === model.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(selectedProviderTab, model.id)}
                  className={`w-full text-left p-2 rounded-xl border-2 transition-all flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-[#FEF08A] border-slate-900 shadow-neo-sm'
                      : 'bg-white border-transparent hover:border-slate-900/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900">{model.name}</span>
                      <span
                        className={`text-[8px] font-extrabold px-1 rounded border ${model.badgeColor}`}
                      >
                        {model.speed}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-black text-slate-900 flex items-center gap-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 line-clamp-1">{model.description}</p>
                </button>
              );
            })}
          </div>

          {/* Footer with settings shortcut */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-bold">
            <span className="text-[10px] text-slate-500">
              Provider: <strong className="text-slate-900">{getProviderConfig(selectedProviderTab).name}</strong>
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-1 text-slate-900 hover:text-amber-700 text-xs font-black hover:underline"
              >
                <Settings className="w-3 h-3" />
                Configure Keys
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
