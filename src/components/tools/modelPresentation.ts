import { AI_PROVIDERS, AIProviderId, AIProviderInfo } from '../../../shared/aiCatalog';

/**
 * Client-side presentation layer for the AI provider catalog.
 *
 * Identity & transport facts (ids, names, default models, base URLs, key
 * requirements) come from shared/aiCatalog.ts — the single source of truth
 * shared with the server (docs/adr/0003). This file adds only what the
 * settings UI needs: marketing copy, badge colours, key links, and curated
 * model lists. It must not restate catalog facts.
 */

export type AIProvider = AIProviderId;

export interface AIModelOption {
  id: string;
  provider: AIProvider;
  name: string;
  tag: string;
  badgeColor: string;
  description: string;
  speed: 'Ultra Fast' | 'Fast' | 'Standard';
  reasoning: 'Standard' | 'High' | 'Deep';
  recommendedFor: string;
  isCustom?: boolean;
}

export interface ProviderConfig extends AIProviderInfo {
  tagline: string;
  badgeColor: string;
  keyPlaceholder: string;
  keyUrl?: string;
  allowsBaseUrl?: boolean;
  models: AIModelOption[];
}

type ProviderPresentation = Pick<
  ProviderConfig,
  'tagline' | 'badgeColor' | 'keyPlaceholder' | 'keyUrl' | 'allowsBaseUrl'
>;

const PRESENTATION: Record<AIProviderId, ProviderPresentation> = {
  gemini: {
    tagline: 'Multimodal, ultra-fast & high context',
    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    keyPlaceholder: 'AIzaSy... (Default server key included)',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    tagline: 'GPT-4o & reasoning models',
    badgeColor: 'bg-slate-900 text-white border-slate-700',
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    tagline: 'Nuanced writing, safety & deep comprehension',
    badgeColor: 'bg-orange-100 text-orange-950 border-orange-400',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  groq: {
    tagline: 'Ultra-low latency LPU inference with open weights',
    badgeColor: 'bg-red-100 text-red-950 border-red-400',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
  },
  deepseek: {
    tagline: 'Leading open reasoning & math breakthroughs',
    badgeColor: 'bg-blue-100 text-blue-950 border-blue-400',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  openrouter: {
    tagline: 'Unified gateway to 200+ global AI models',
    badgeColor: 'bg-violet-100 text-violet-950 border-violet-400',
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    tagline: 'Private, offline, or self-hosted OpenAI-compatible endpoint',
    badgeColor: 'bg-yellow-100 text-yellow-950 border-yellow-400',
    keyPlaceholder: 'Optional (e.g. "ollama" or API key)',
    allowsBaseUrl: true,
  },
};

const MODELS: Record<AIProviderId, AIModelOption[]> = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      name: 'Gemini 2.5 Flash',
      tag: 'Fast & Versatile (Multimodal)',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Ultra-fast multimodal vision model featuring high-speed note synthesis, lecture slide parsing, and rapid quizzes.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor:
        'Interactive notes synthesis, quick quizzes, active recall drills, and diagram parsing.',
    },
    {
      id: 'gemini-3.8-flash',
      provider: 'gemini',
      name: 'Gemini 3.8 Flash',
      tag: 'High-Demand Resilient & Agile',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
      description:
        'Next-generation Gemini Flash variant optimized for fast reasoning, PDF extraction, and low-latency study sessions.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Lecture PDF OCR extraction, speed drilling, and continuous study sessions.',
    },
    {
      id: 'gemini-2.5-pro',
      provider: 'gemini',
      name: 'Gemini 2.5 Pro',
      tag: 'Flagship Offering (Deep STEM & Vision)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Google’s premier multimodal vision model for deep academic reasoning, complex STEM formulas, and comprehensive exam grading.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Hard diagnostic mock exams, multi-step problem solving, and complex tutoring.',
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      provider: 'openai',
      name: 'GPT-4o',
      tag: 'Flagship Offering (Omni Multimodal)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'OpenAI’s premier omni model for rigorous academic mock exams, code analysis, and high-level reasoning.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Complex multi-concept mock exams and detailed analytical grading.',
    },
    {
      id: 'gpt-4o-mini',
      provider: 'openai',
      name: 'GPT-4o Mini',
      tag: 'Budget Offering (Cheap & Fast)',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Affordable, low-latency workhorse model delivering high speed for everyday study drills and flashcards.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Interactive notes synthesis and active-recall flashcard drills.',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-7-sonnet-20250219',
      provider: 'anthropic',
      name: 'Claude 3.7 Sonnet',
      tag: 'Flagship Offering (Hybrid Reasoning)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Anthropic’s state-of-the-art hybrid reasoning flagship for master-level academic tutoring, deep critique, and complex syllabus synthesis.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Exhaustive syllabus outlines, rigorous diagnostic tests, and deep tutoring.',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      name: 'Claude 3.5 Haiku',
      tag: 'Budget Offering (Ultra Fast)',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-400',
      description:
        'Rapid response time with exceptional writing tone and precise flashcard generation at low cost.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Rapid Q&A, active tutoring, and quick concept definitions.',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      provider: 'groq',
      name: 'Llama 3.3 70B (Versatile)',
      tag: 'Flagship Offering (70B Intelligence)',
      badgeColor: 'bg-red-100 text-red-900 border-red-400',
      description:
        '70-billion parameter model running on Groq LPUs at 300+ tokens/sec for rich academic synthesis.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Instantaneous quizzes, zero-latency study chat, and interactive summaries.',
    },
    {
      id: 'llama-3.1-8b-instant',
      provider: 'groq',
      name: 'Llama 3.1 8B Instant',
      tag: 'Budget Offering (Sub-Second 800 t/s)',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Lightweight model with nearly instantaneous 800+ tokens/sec output for rapid speed drilling and flashcard generation.',
      speed: 'Ultra Fast',
      reasoning: 'Standard',
      recommendedFor: 'Speed drilling, rapid term definitions, and flashcard generation.',
    },
  ],
  deepseek: [
    {
      id: 'deepseek-reasoner',
      provider: 'deepseek',
      name: 'DeepSeek-R1 (Reasoner)',
      tag: 'Flagship Offering (Chain-of-Thought)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Open reasoning model specializing in mathematical derivations, physics proofs, and STEM derivations.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Math derivations, STEM exam questions, and complex concept deconstruction.',
    },
    {
      id: 'deepseek-chat',
      provider: 'deepseek',
      name: 'DeepSeek-V3',
      tag: 'Budget Offering (High Value MoE)',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-400',
      description:
        'Top-tier 671B parameter Mixture-of-Experts model delivering versatile general intelligence at minimal token cost.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Comprehensive notes synthesis, mock exams, and quiz generation.',
    },
  ],
  openrouter: [
    {
      id: 'deepseek/deepseek-r1',
      provider: 'openrouter',
      name: 'DeepSeek R1',
      tag: 'Flagship Offering (Open Reasoning)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'DeepSeek R1 reasoning routed via OpenRouter for advanced academic problem-solving and diagnostics.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Advanced academic problem solving and deep tutor dialogues.',
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      provider: 'openrouter',
      name: 'Llama 3.3 70B Instruct',
      tag: 'Budget Offering (Cost-Effective)',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Cost-effective high-availability open model for notes, quizzes, and study tutor conversations.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Reliable study notes, quizzes, and mock exams.',
    },
  ],
  custom: [
    {
      id: 'llama3.3:70b',
      provider: 'custom',
      name: 'Llama 3.3 70B (Local)',
      tag: 'Flagship Offering (Private 70B)',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Flagship local model for private, offline, high-capacity academic synthesis without data leaving your device.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Offline study sessions, private notes, and local hardware inference.',
      isCustom: true,
    },
    {
      id: 'llama3.2:3b',
      provider: 'custom',
      name: 'Llama 3.2 3B (Local)',
      tag: 'Budget Offering (Ultra-Lightweight)',
      badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-400',
      description:
        'Ultra-lightweight local model that runs effortlessly on any laptop with minimal RAM for offline study drills.',
      speed: 'Ultra Fast',
      reasoning: 'Standard',
      recommendedFor: 'Local term explanations and flashcard quizzes.',
      isCustom: true,
    },
  ],
};

/** Presentation joined onto the shared catalog's identity & transport facts. */
export const AVAILABLE_PROVIDERS: ProviderConfig[] = AI_PROVIDERS.map((info) => ({
  ...info,
  ...PRESENTATION[info.id],
  models: MODELS[info.id],
}));

export function getProviderConfig(providerId?: string): ProviderConfig {
  return AVAILABLE_PROVIDERS.find((p) => p.id === providerId) || AVAILABLE_PROVIDERS[0];
}

export function getModelOption(providerId?: string, modelId?: string): AIModelOption {
  const provider = getProviderConfig(providerId);
  const found = provider.models.find((m) => m.id === modelId);
  if (found) return found;

  // If custom model id was specified
  if (modelId && modelId.trim()) {
    return {
      id: modelId.trim(),
      provider: provider.id,
      name: modelId.trim(),
      tag: 'Custom Model',
      badgeColor: 'bg-slate-100 text-slate-900 border-slate-400',
      description: `Custom model identifier (${modelId}) on ${provider.name}.`,
      speed: 'Fast',
      reasoning: 'Standard',
      recommendedFor: 'Custom workflows and user-specified model architectures.',
      isCustom: true,
    };
  }

  return provider.models[0];
}
