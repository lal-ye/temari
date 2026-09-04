export interface Subject {
  id: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface StoredNote {
  id: string;
  subjectId: string;
  title: string;
  content: string; // Markdown content with headings, tables, mermaid diagrams, etc.
  sourceName?: string; // Original source filename or "Pasted Material"
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags?: string[];
}

export interface StoredQuiz {
  id: string;
  subjectId: string;
  name: string;
  flashcards: Flashcard[];
  courseMaterialExtract?: string;
  quizLengthUsed: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  createdAt: string;
  updatedAt: string;
  lastScore?: number;
  timesPracticed?: number;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface ExamQuestion {
  id?: string;
  question: string;
  type: QuestionType;
  options?: string[]; // 4 options for multiple choice
  correctAnswer: string;
  explanation?: string;
  topic: string;
}

export interface ExamResult {
  question: string;
  type: QuestionType;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  topic: string;
}

export interface Article {
  title: string;
  url: string;
  snippet?: string;
}

export interface StoredAttempt {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  type: 'Exam' | 'Quiz';
  date: string; // ISO string or YYYY-MM-DD
  timeSpentSeconds?: number;
  examQuestions?: ExamQuestion[];
  examResults?: ExamResult[];
  overallScore: number; // percentage 0-100
  totalQuestions: number;
  correctQuestions: number;
  topicsToReview?: string[];
  extraReadings?: Article[];
}

export interface TopicPerformance {
  topic: string;
  accuracy: number; // Percentage
  correct: number;
  total: number;
}

export interface QuizScoreDistributionItem {
  name: string; // e.g., "0-59%", "60-69%", "70-79%", "80-89%", "90-100%"
  count: number;
}

export interface DatedScore {
  date: string;
  score: number;
  name: string;
  type: 'Quiz' | 'Exam';
}

export interface AnalyticsSummary {
  overallAverageScore: number;
  quizzesTaken: number;
  examsTaken: number;
  lastActivityDate: string | null;
  overallScoreProgress: DatedScore[];
  topicPerformance: TopicPerformance[];
  areasForImprovement: TopicPerformance[];
  quizScoreDistribution: QuizScoreDistributionItem[];
}

export interface StudyTask {
  id: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedMinutes?: number;
  completed: boolean;
  type?: 'exam' | 'quiz' | 'reading' | 'assignment' | string;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface UserSettings {
  apiKey?: string;
  selectedProvider?: AIProvider;
  selectedModel?: string;
  providerKeys?: Record<string, string>;
  providerModels?: Record<string, string>;
  customBaseUrl?: string;
  customModelName?: string;
  theme: 'dark' | 'light' | 'neobrutalist';
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  soundEnabled: boolean;
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'custom';

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

export type GeminiModelOption = AIModelOption;

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  tagline: string;
  badgeColor: string;
  keyPlaceholder: string;
  keyUrl?: string;
  requiresKey: boolean;
  allowsBaseUrl?: boolean;
  defaultBaseUrl?: string;
  defaultModel: string;
  models: AIModelOption[];
}

export const AVAILABLE_PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Multimodal, ultra-fast & high context',
    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    keyPlaceholder: 'AIzaSy... (Default server key included)',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    requiresKey: false,
    defaultModel: 'gemini-2.5-flash',
    models: [
      {
        id: 'gemini-2.5-flash',
        provider: 'gemini',
        name: 'Gemini 2.5 Flash',
        tag: 'Fast & Versatile (Multimodal)',
        badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
        description: 'Ultra-fast multimodal vision model featuring high-speed note synthesis, lecture slide parsing, and rapid quizzes.',
        speed: 'Ultra Fast',
        reasoning: 'High',
        recommendedFor: 'Interactive notes synthesis, quick quizzes, active recall drills, and diagram parsing.',
      },
      {
        id: 'gemini-3.8-flash',
        provider: 'gemini',
        name: 'Gemini 3.8 Flash',
        tag: 'High-Demand Resilient & Agile',
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
        description: 'Next-generation Gemini Flash variant optimized for fast reasoning, PDF extraction, and low-latency study sessions.',
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
        description: 'Google’s premier multimodal vision model for deep academic reasoning, complex STEM formulas, and comprehensive exam grading.',
        speed: 'Standard',
        reasoning: 'Deep',
        recommendedFor: 'Hard diagnostic mock exams, multi-step problem solving, and complex tutoring.',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o & reasoning models',
    badgeColor: 'bg-slate-900 text-white border-slate-700',
    keyPlaceholder: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
    defaultModel: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        tag: 'Flagship Offering (Omni Multimodal)',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
        description: 'OpenAI’s premier omni model for rigorous academic mock exams, code analysis, and high-level reasoning.',
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
        description: 'Affordable, low-latency workhorse model delivering high speed for everyday study drills and flashcards.',
        speed: 'Ultra Fast',
        reasoning: 'High',
        recommendedFor: 'Interactive notes synthesis and active-recall flashcard drills.',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    tagline: 'Nuanced writing, safety & deep comprehension',
    badgeColor: 'bg-orange-100 text-orange-950 border-orange-400',
    keyPlaceholder: 'sk-ant-api03-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      {
        id: 'claude-3-7-sonnet-20250219',
        provider: 'anthropic',
        name: 'Claude 3.7 Sonnet',
        tag: 'Flagship Offering (Hybrid Reasoning)',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
        description: 'Anthropic’s state-of-the-art hybrid reasoning flagship for master-level academic tutoring, deep critique, and complex syllabus synthesis.',
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
        description: 'Rapid response time with exceptional writing tone and precise flashcard generation at low cost.',
        speed: 'Ultra Fast',
        reasoning: 'High',
        recommendedFor: 'Rapid Q&A, active tutoring, and quick concept definitions.',
      },
    ],
  },
  {
    id: 'groq',
    name: 'Groq (Llama)',
    tagline: 'Ultra-low latency LPU inference with open weights',
    badgeColor: 'bg-red-100 text-red-950 border-red-400',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    requiresKey: true,
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        provider: 'groq',
        name: 'Llama 3.3 70B (Versatile)',
        tag: 'Flagship Offering (70B Intelligence)',
        badgeColor: 'bg-red-100 text-red-900 border-red-400',
        description: '70-billion parameter model running on Groq LPUs at 300+ tokens/sec for rich academic synthesis.',
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
        description: 'Lightweight model with nearly instantaneous 800+ tokens/sec output for rapid speed drilling and flashcard generation.',
        speed: 'Ultra Fast',
        reasoning: 'Standard',
        recommendedFor: 'Speed drilling, rapid term definitions, and flashcard generation.',
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'Leading open reasoning & math breakthroughs',
    badgeColor: 'bg-blue-100 text-blue-950 border-blue-400',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    requiresKey: true,
    defaultModel: 'deepseek-chat',
    models: [
      {
        id: 'deepseek-reasoner',
        provider: 'deepseek',
        name: 'DeepSeek-R1 (Reasoner)',
        tag: 'Flagship Offering (Chain-of-Thought)',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
        description: 'Open reasoning model specializing in mathematical derivations, physics proofs, and STEM derivations.',
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
        description: 'Top-tier 671B parameter Mixture-of-Experts model delivering versatile general intelligence at minimal token cost.',
        speed: 'Fast',
        reasoning: 'High',
        recommendedFor: 'Comprehensive notes synthesis, mock exams, and quiz generation.',
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Unified gateway to 200+ global AI models',
    badgeColor: 'bg-violet-100 text-violet-950 border-violet-400',
    keyPlaceholder: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    requiresKey: true,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    models: [
      {
        id: 'deepseek/deepseek-r1',
        provider: 'openrouter',
        name: 'DeepSeek R1',
        tag: 'Flagship Offering (Open Reasoning)',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
        description: 'DeepSeek R1 reasoning routed via OpenRouter for advanced academic problem-solving and diagnostics.',
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
        description: 'Cost-effective high-availability open model for notes, quizzes, and study tutor conversations.',
        speed: 'Fast',
        reasoning: 'High',
        recommendedFor: 'Reliable study notes, quizzes, and mock exams.',
      },
    ],
  },
  {
    id: 'custom',
    name: 'Custom / Local (Ollama, LM Studio)',
    tagline: 'Private, offline, or self-hosted OpenAI-compatible endpoint',
    badgeColor: 'bg-yellow-100 text-yellow-950 border-yellow-400',
    keyPlaceholder: 'Optional (e.g. "ollama" or API key)',
    allowsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
    defaultModel: 'llama3.2:3b',
    models: [
      {
        id: 'llama3.3:70b',
        provider: 'custom',
        name: 'Llama 3.3 70B (Local)',
        tag: 'Flagship Offering (Private 70B)',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
        description: 'Flagship local model for private, offline, high-capacity academic synthesis without data leaving your device.',
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
        description: 'Ultra-lightweight local model that runs effortlessly on any laptop with minimal RAM for offline study drills.',
        speed: 'Ultra Fast',
        reasoning: 'Standard',
        recommendedFor: 'Local term explanations and flashcard quizzes.',
        isCustom: true,
      },
    ],
  },
];

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] =
  AVAILABLE_PROVIDERS.find((p) => p.id === 'gemini')?.models || [];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_AI_PROVIDER: AIProvider = 'gemini';

export function getProviderConfig(providerId?: string): ProviderConfig {
  return (
    AVAILABLE_PROVIDERS.find((p) => p.id === providerId) ||
    AVAILABLE_PROVIDERS[0]
  );
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

/**
 * Dynamically resolves the user's active model for the given or active provider.
 * Priority:
 * 1. Provider-specific selected model (settings.providerModels[provider])
 * 2. Active selected model if provider matches or is default
 * 3. Provider's designated default model
 */
export function getActiveModelForProvider(
  settings?: Partial<UserSettings> | null,
  providerId?: AIProvider
): string {
  const provider = providerId || settings?.selectedProvider || 'gemini';
  if (settings?.providerModels && settings.providerModels[provider]) {
    return settings.providerModels[provider];
  }
  if (
    settings?.selectedModel &&
    (settings.selectedProvider === provider || !settings.selectedProvider)
  ) {
    return settings.selectedModel;
  }
  const config = getProviderConfig(provider);
  return config.defaultModel;
}


