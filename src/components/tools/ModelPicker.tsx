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
} from './modelPresentation';
import { resolveActiveModel } from '../../../shared/aiCatalog';
import { studyStore, useSettings } from '../../hooks/useStudyStore';
import { Button } from '../ui/button';
import { aiConnection } from '../../services/aiConnection';

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
  const activeModelId = resolveActiveModel(settings, activeProviderId);

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

      const res = await aiConnection.fetchLiveModels({
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
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              1. Choose AI Provider
            </label>
            <span className="text-[10px] font-medium text-muted-foreground">
              Active: <strong className="text-foreground font-semibold">{currentProviderConfig.name}</strong>
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
                  className={`p-2 rounded-xl border text-left transition-colors relative flex flex-col gap-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                      : 'bg-card border-border/80 hover:border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {getProviderIcon(provider.id)}
                      <span className="text-xs font-semibold text-foreground truncate">
                        {provider.name.split(' ')[0]}
                      </span>
                    </div>
                    {isSavedActive && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-card"
                        title="Currently active"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium mt-0.5">
                    <span className="truncate max-w-[85px]">
                      {provider.id === 'custom' ? 'Local / Self-hosted' : provider.id.toUpperCase()}
                    </span>
                    {hasKey ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-semibold">
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
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              2. Curated Model Options on {tabProviderConfig.name}
            </label>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded">
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
                  className={`w-full text-left p-3 rounded-xl border transition-colors relative flex flex-col justify-between gap-1.5 outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20'
                      : 'bg-card border-border/80 hover:border-border hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-foreground">{model.name}</span>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${model.badgeColor}`}
                      >
                        {model.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-snug">{model.description}</p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> {model.speed}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Brain className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" /> {model.reasoning}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          <Check className="w-3 h-3 stroke-[3]" /> Active
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-muted-foreground/70 truncate max-w-[80px]">
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
            <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <div>
                  <span className="text-xs font-semibold text-violet-800 dark:text-violet-300">Active Custom Model: </span>
                  <span className="font-mono text-xs font-semibold text-violet-700 dark:text-violet-400">{activeModelId}</span>
                </div>
              </div>
              <span className="text-[9px] font-semibold uppercase bg-violet-500/15 text-violet-800 dark:text-violet-300 px-2 py-0.5 rounded border border-violet-500/20">
                Custom Specified
              </span>
            </div>
          )}
        </div>

        {/* Programmatic Live Discovery & Custom Model Feature */}
        <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                  Programmatic Live Model Discovery & Custom ID
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Check programmatically what {tabProviderConfig.name}&apos;s live API currently offers, or specify any model ID.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleScanLiveModels}
              disabled={isScanningLive}
            >
              <RefreshCw className={`size-3.5 ${isScanningLive ? 'animate-spin' : ''}`} />
              <span>{isScanningLive ? 'Querying API…' : `Query ${tabProviderConfig.name} Live API`}</span>
            </Button>
          </div>

          {/* Error Message if Scan Failed */}
          {liveScanError && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{liveScanError}</p>
                {tabProviderConfig.requiresKey && !hasKeyForProvider(tabProviderConfig.id) && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Tip: Enter your API key below in section 3 first, then click query again.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Live Models Discovered Drawer */}
          {showLiveDrawer && liveModels.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Live Verified: {liveModels.length} models discovered on {tabProviderConfig.name} API
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
                  <input
                    type="text"
                    value={liveSearchFilter}
                    onChange={(e) => setLiveSearchFilter(e.target.value)}
                    placeholder="Filter live models..."
                    className="pl-7 pr-2 py-1 text-[11px] bg-background border border-border rounded-lg text-foreground w-36 sm:w-48 font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-border/60 scrollbar-thin">
                {filteredLiveModels.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center font-medium">
                    No models match &ldquo;{liveSearchFilter}&rdquo;
                  </p>
                ) : (
                  filteredLiveModels.map((m) => {
                    const isSelected = activeModelId === m.id && activeProviderId === tabProviderConfig.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelect(tabProviderConfig.id, m.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/10 border border-amber-500/30 font-semibold'
                            : 'border border-transparent hover:bg-muted/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-medium text-foreground truncate">
                              {m.id}
                            </span>
                            {m.isVisionCapable && (
                              <span className="text-[9px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 px-1 py-0.5 rounded">
                                Vision
                              </span>
                            )}
                            {m.contextWindow && (
                              <span className="text-[9px] font-medium text-muted-foreground">
                                ({Math.round(m.contextWindow / 1000)}k ctx)
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-sm">
                              {m.description}
                            </p>
                          )}
                        </div>

                        {isSelected ? (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-[10px] font-medium px-2 py-0.5 bg-muted hover:bg-muted/70 text-foreground border border-border rounded transition-colors whitespace-nowrap"
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
              className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs placeholder:text-muted-foreground/70"
            />
            <Button type="submit" size="sm" disabled={!customInputId.trim()}>
              <span>Apply ID</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card hover:bg-muted/60 text-foreground text-xs font-medium rounded-lg border border-border/80 shadow-xs transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring max-w-[170px]"
        title={`AI Model: ${currentProviderConfig.name} - ${currentModelOption.name}`}
        aria-label="Change AI Model and Provider"
      >
        {getProviderIcon(activeProviderId)}
        <span className="hidden sm:inline font-semibold text-foreground truncate max-w-[130px]">
          {currentModelOption.name.replace('Gemini ', '').replace(' (Local Ollama)', '')}
        </span>
        <span className="sm:hidden font-semibold text-foreground text-[11px]">
          {currentProviderConfig.name.split(' ')[0]}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-popover text-popover-foreground border border-border rounded-xl shadow-md z-50 p-3 space-y-2.5 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-1 flex items-center justify-between border-b border-border pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Model-Agnostic AI Switcher
            </span>
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              7 Providers Supported
            </span>
          </div>

          {/* Quick Provider Horizontal Scroll Chips */}
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {AVAILABLE_PROVIDERS.map((p) => {
              const isSelected = p.id === selectedProviderTab;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProviderTab(p.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
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
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/30 text-foreground font-medium shadow-2xs'
                      : 'bg-card border-border/50 hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{model.name}</span>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${model.badgeColor}`}
                      >
                        {model.speed}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{model.description}</p>
                </button>
              );
            })}
          </div>

          {/* Footer with settings shortcut */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-medium">
            <span className="text-[10px] text-muted-foreground">
              Provider: <strong className="text-foreground font-semibold">{getProviderConfig(selectedProviderTab).name}</strong>
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-1 text-foreground hover:text-amber-600 dark:hover:text-amber-400 text-xs font-semibold hover:underline"
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
