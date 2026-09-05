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
    tagline: 'Free tier available, handles images and PDFs',
    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    keyPlaceholder: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  openai: {
    tagline: 'GPT-5.6 family, strong all-round reasoning',
    badgeColor: 'bg-slate-900 text-white border-slate-700',
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    tagline: 'Best prose quality, large context windows',
    badgeColor: 'bg-orange-100 text-orange-950 border-orange-400',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  groq: {
    tagline: 'Fastest replies, generous free tier',
    badgeColor: 'bg-red-100 text-red-950 border-red-400',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
  },
  deepseek: {
    tagline: 'Cheapest capable models, strong at maths',
    badgeColor: 'bg-blue-100 text-blue-950 border-blue-400',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  openrouter: {
    tagline: 'One key for many providers',
    badgeColor: 'bg-violet-100 text-violet-950 border-violet-400',
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    tagline: 'Runs on your own machine, works offline',
    badgeColor: 'bg-yellow-100 text-yellow-950 border-yellow-400',
    keyPlaceholder: 'Optional (e.g. "ollama" or API key)',
    allowsBaseUrl: true,
  },
};

/**
 * Curated shortlist per provider.
 *
 * Two or three models each, not the full catalogue: the picker exists so a
 * learner can make a fast, correct choice, and a wall of near-identical names
 * is how that decision gets harder rather than easier. Anything outside this
 * list is still reachable through "Scan live models", which asks the provider
 * what the learner's own key can actually see.
 *
 * Descriptions say what the model is good and bad at in plain words. Vendor
 * superlatives ("premier", "state-of-the-art") describe every model equally
 * and so help nobody choose.
 *
 * Model ids are checked against provider deprecation schedules; retired ids
 * are listed in RETIRED_MODELS in shared/aiCatalog.ts so stored settings can
 * be migrated instead of silently failing.
 */
const MODELS: Record<AIProviderId, AIModelOption[]> = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      name: 'Gemini 2.5 Flash',
      tag: 'Recommended',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Fast, handles images and PDFs, and cheap enough to regenerate notes freely. The sensible default for everyday study.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Notes, flashcards, and lecture PDFs.',
    },
    {
      id: 'gemini-2.5-pro',
      provider: 'gemini',
      name: 'Gemini 2.5 Pro',
      tag: 'Deeper reasoning',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Slower and pricier, but better at multi-step derivations and marking exam answers where the reasoning matters more than the speed.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Mock exams, STEM problem sets, and grading.',
    },
    {
      id: 'gemini-3.8-flash',
      provider: 'gemini',
      name: 'Gemini 3.8 Flash',
      tag: 'Newest',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
      description:
        'The current Flash generation. Stronger reasoning than 2.5 Flash at similar speed; availability varies by account.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Everyday study once your key has access.',
    },
  ],
  openai: [
    {
      id: 'gpt-5.6-terra',
      provider: 'openai',
      name: 'GPT-5.6 Terra',
      tag: 'Recommended',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'The mid tier: good reasoning at roughly a third of flagship cost. The right default unless a task is genuinely hard.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Notes, quizzes, and most day-to-day generation.',
    },
    {
      id: 'gpt-5.6-sol',
      provider: 'openai',
      name: 'GPT-5.6 Sol',
      tag: 'Flagship',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Strongest reasoning OpenAI sells, and priced like it. Worth it for hard exam grading, wasteful for flashcards.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Difficult exams and detailed feedback.',
    },
    {
      id: 'gpt-5.6-luna',
      provider: 'openai',
      name: 'GPT-5.6 Luna',
      tag: 'Cheapest',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-400',
      description:
        'Very cheap and very fast. Fine for definitions and simple cards; it will struggle with long source material.',
      speed: 'Ultra Fast',
      reasoning: 'Standard',
      recommendedFor: 'Term explanations and high-volume drills.',
    },
  ],
  anthropic: [
    {
      id: 'claude-haiku-4-5',
      provider: 'anthropic',
      name: 'Claude Haiku 4.5',
      tag: 'Recommended',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Fast and inexpensive with unusually clean prose, which shows in generated notes. 200K context.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Notes, summaries, and quick explanations.',
    },
    {
      id: 'claude-sonnet-5',
      provider: 'anthropic',
      name: 'Claude Sonnet 5',
      tag: 'Balanced',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-400',
      description:
        'The middle tier, with a 1M context window that swallows an entire textbook chapter without splitting it.',
      speed: 'Fast',
      reasoning: 'Deep',
      recommendedFor: 'Long source material and full syllabus outlines.',
    },
    {
      id: 'claude-opus-5',
      provider: 'anthropic',
      name: 'Claude Opus 5',
      tag: 'Flagship',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Best at sustained, careful reasoning. Expensive per token, so reach for it on hard material rather than routine drills.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Rigorous exams and deep tutoring.',
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      provider: 'groq',
      name: 'Llama 3.3 70B',
      tag: 'Recommended',
      badgeColor: 'bg-red-100 text-red-900 border-red-400',
      description:
        'Open weights on Groq hardware, so replies arrive almost instantly. Free tier allows about 1,000 requests a day.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Fast quizzes and interactive study.',
    },
    {
      id: 'llama-3.1-8b-instant',
      provider: 'groq',
      name: 'Llama 3.1 8B Instant',
      tag: 'Highest free limits',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Smaller and less capable, but the most generous free allowance here at roughly 14,400 requests a day.',
      speed: 'Ultra Fast',
      reasoning: 'Standard',
      recommendedFor: 'Heavy drilling on a free key.',
    },
    {
      id: 'openai/gpt-oss-120b',
      provider: 'groq',
      name: 'GPT-OSS 120B',
      tag: 'Open weights',
      badgeColor: 'bg-slate-100 text-slate-900 border-slate-400',
      description:
        "OpenAI's open-weight model served on Groq. Stronger reasoning than Llama 3.3 at comparable speed.",
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Reasoning-heavy work on a free tier.',
    },
  ],
  deepseek: [
    {
      id: 'deepseek-v4-flash',
      provider: 'deepseek',
      name: 'DeepSeek V4 Flash',
      tag: 'Recommended',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-400',
      description:
        'Among the cheapest capable models available, with a 1M context window. Thinking mode is on by default, so replies can be slower than the price suggests.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Cost-sensitive study across long material.',
    },
    {
      id: 'deepseek-v4-pro',
      provider: 'deepseek',
      name: 'DeepSeek V4 Pro',
      tag: 'Deeper reasoning',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Larger sibling, notably strong on mathematical derivations and physics. Still far cheaper than Western flagships.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Maths and STEM problem solving.',
    },
  ],
  openrouter: [
    {
      id: 'deepseek/deepseek-v4-flash',
      provider: 'openrouter',
      name: 'DeepSeek V4 Flash',
      tag: 'Recommended',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-400',
      description:
        'Cheap, long-context, and routed through OpenRouter so one key reaches many providers.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Everyday study on a single shared key.',
    },
    {
      id: 'anthropic/claude-haiku-4.5',
      provider: 'openrouter',
      name: 'Claude Haiku 4.5',
      tag: 'Best writing',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Claude prose quality without an Anthropic account. Slightly more expensive than routing to DeepSeek.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Notes where wording matters.',
    },
    {
      id: 'google/gemini-2.5-flash',
      provider: 'openrouter',
      name: 'Gemini 2.5 Flash',
      tag: 'Multimodal',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
      description:
        'Handles images and PDFs, useful when your source material is scanned slides.',
      speed: 'Ultra Fast',
      reasoning: 'High',
      recommendedFor: 'Scanned lecture slides and diagrams.',
    },
  ],
  custom: [
    {
      id: 'llama3.2',
      provider: 'custom',
      name: 'Llama 3.2 (local)',
      tag: 'Recommended',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      description:
        'Runs on a normal laptop through Ollama. Nothing leaves your machine, and it works with no internet at all.',
      speed: 'Fast',
      reasoning: 'Standard',
      recommendedFor: 'Private, offline study.',
      isCustom: true,
    },
    {
      id: 'llama3.3:70b',
      provider: 'custom',
      name: 'Llama 3.3 70B (local)',
      tag: 'Needs strong hardware',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
      description:
        'Much more capable locally, but wants roughly 40GB of memory. Slow or unusable on a typical laptop.',
      speed: 'Standard',
      reasoning: 'Deep',
      recommendedFor: 'Offline work on a workstation or Mac with lots of RAM.',
      isCustom: true,
    },
    {
      id: 'qwen2.5:7b',
      provider: 'custom',
      name: 'Qwen 2.5 7B (local)',
      tag: 'Good middle ground',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-400',
      description:
        'Stronger than Llama 3.2 at maths while still fitting comfortably on consumer hardware.',
      speed: 'Fast',
      reasoning: 'High',
      recommendedFor: 'Offline STEM study.',
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
