import { GoogleGenAI } from '@google/genai';
import { AIProviderId, getProviderInfo } from '../shared/aiCatalog.ts';

// Provider identity & transport facts come from the shared catalog (docs/adr/0003).
export type { AIProviderId };

export interface ChatMessageItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ExecuteAiOptions {
  provider?: AIProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  prompt?: string;
  messages?: ChatMessageItem[];
  jsonResponse?: boolean;
  maxTokens?: number;
  temperature?: number;
  pdfDataUri?: string;
}

export interface ExecuteAiResult {
  text: string;
  provider: AIProviderId;
  model: string;
}

// Global cached Gemini instances
const geminiClients = new Map<string, GoogleGenAI>();

function getGeminiClient(customKey?: string): GoogleGenAI | null {
  const key = customKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) return null;

  let client = geminiClients.get(key);
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
    geminiClients.set(key, client);
  }
  return client;
}

/**
 * Cleanly extract and parse JSON from an LLM response string.
 * Handles markdown ```json fences, trailing commas, and leading commentary.
 */
export function parseStructuredJson<T = any>(rawText: string, fallback?: T): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty or invalid response from AI model');
  }

  const trimmed = rawText.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue to extract
  }

  // 2. Extract from markdown code fence ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // continue to heuristic extraction
    }
  }

  // 3. Find first { ... } or [ ... ]
  const firstCurly = trimmed.indexOf('{');
  const lastCurly = trimmed.lastIndexOf('}');
  if (firstCurly !== -1 && lastCurly > firstCurly) {
    const candidate = trimmed.substring(firstCurly, lastCurly + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // ignore
    }
  }

  const firstSquare = trimmed.indexOf('[');
  const lastSquare = trimmed.lastIndexOf(']');
  if (firstSquare !== -1 && lastSquare > firstSquare) {
    const candidate = trimmed.substring(firstSquare, lastSquare + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // ignore
    }
  }

  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to parse structured JSON from AI output: ${trimmed.slice(0, 150)}...`);
}

/**
 * Model-agnostic AI execution dispatcher
 */
export async function executeAiRequest(options: ExecuteAiOptions): Promise<ExecuteAiResult> {
  const provider: AIProviderId = options.provider || 'gemini';

  // Transport facts (defaults, base URLs, server env keys) come from the shared
  // catalog — this dispatcher only chooses the transport mechanism per provider.
  const catalogInfo = getProviderInfo(provider);

  switch (provider) {
    case 'gemini':
      return executeGemini(options);
    case 'openai':
    case 'groq':
    case 'deepseek':
    case 'openrouter':
    case 'custom':
      return executeOpenAICompatible(options, {
        providerName: catalogInfo.name,
        defaultBaseUrl: catalogInfo.defaultBaseUrl,
        defaultModel: catalogInfo.defaultModel,
        envKey: catalogInfo.envKeyName ? process.env[catalogInfo.envKeyName] : undefined,
        ...(provider === 'openrouter'
          ? {
              extraHeaders: {
                'HTTP-Referer': 'https://temari.study',
                'X-Title': 'Temari AI Study Companion',
              },
            }
          : {}),
        ...(provider === 'custom' ? { isLocal: true } : {}),
      });
    case 'anthropic':
      return executeAnthropic(options);
    default:
      return executeGemini(options);
  }
}

/**
 * Detect transient / high-demand / capacity / rate-limit errors from Gemini
 */
function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;
  const str =
    typeof err === 'string'
      ? err
      : `${err.message || ''} ${err.status || ''} ${err.code || ''} ${JSON.stringify(err)}`;
  return (
    str.includes('503') ||
    str.includes('UNAVAILABLE') ||
    str.includes('high demand') ||
    str.includes('Spikes in demand') ||
    str.includes('429') ||
    str.includes('RESOURCE_EXHAUSTED') ||
    str.includes('overloaded') ||
    str.includes('temporarily unavailable') ||
    str.includes('Service Unavailable')
  );
}

/**
 * Return ordered candidate models to try if the primary model is busy or hits 503
 */
function getGeminiCandidateModels(requestedModel?: string): string[] {
  const primary = requestedModel?.trim() || 'gemini-2.5-flash';
  const fallbacks = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-pro'];
  const candidates: string[] = [primary];
  for (const fb of fallbacks) {
    if (!candidates.includes(fb)) {
      candidates.push(fb);
    }
  }
  return candidates;
}

/**
 * Google Gemini Provider Execution with automatic model fallback & retry on 503 high-demand
 */
async function executeGemini(options: ExecuteAiOptions): Promise<ExecuteAiResult> {
  const client = getGeminiClient(options.apiKey);

  if (!client) {
    throw new Error(
      'No Gemini API Key available. Please provide a key in Settings or configure GEMINI_API_KEY.'
    );
  }

  const candidateModels = getGeminiCandidateModels(options.model);
  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (mIdx > 0 || attempt > 1) {
        // Exponential backoff before retry or switching candidate models
        const delayMs = mIdx > 0 ? 500 : attempt * 700;
        await new Promise((res) => setTimeout(res, delayMs));
      }

      try {
        // Handle PDF Multimodal extraction
        if (options.pdfDataUri) {
          const matches = options.pdfDataUri.match(/^data:(.+?);base64,(.+)$/);
          if (!matches) {
            throw new Error('Invalid base64 PDF data URI format');
          }
          const mimeType = matches[1];
          const base64Data = matches[2];

          const response = await client.models.generateContent({
            model: currentModel,
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text:
                  options.prompt ||
                  'Extract all key study text, conceptual definitions, headings, and outlines from this document cleanly in Markdown format.',
              },
            ],
          });

          return {
            text: response.text || '',
            provider: 'gemini',
            model: currentModel,
          };
        }

        // Construct Gemini contents
        let contents: any;

        if (options.messages && options.messages.length > 0) {
          const historyText = options.messages
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');
          contents = options.systemPrompt
            ? `${options.systemPrompt}\n\n${historyText}\n\nASSISTANT:`
            : `${historyText}\n\nASSISTANT:`;
        } else {
          contents = options.systemPrompt
            ? `${options.systemPrompt}\n\n${options.prompt || ''}`
            : options.prompt || '';
        }

        const config: any = {};
        if (options.jsonResponse) {
          config.responseMimeType = 'application/json';
        }

        const response = await client.models.generateContent({
          model: currentModel,
          contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        return {
          text: response.text || '',
          provider: 'gemini',
          model: currentModel,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[executeGemini] Model ${currentModel} attempt ${attempt} failed:`,
          err?.message || err
        );

        if (!isRetryableGeminiError(err)) {
          // If the error is non-transient (e.g. auth failure, bad request), don't loop needlessly
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini candidate models experienced temporary high demand. Please try again in a moment.');
}

/**
 * OpenAI-Compatible Provider Execution
 * Handles OpenAI, Groq, DeepSeek, OpenRouter, and Local Ollama / LM Studio.
 */
interface OpenAICompatibleConfig {
  providerName: string;
  /**
   * Default base URL from the shared catalog. Typed optional to mirror
   * AIProviderInfo (Gemini/Anthropic have none); every provider routed through
   * executeOpenAICompatible defines one, and options.baseUrl can always override.
   */
  defaultBaseUrl?: string;
  defaultModel: string;
  envKey?: string;
  isLocal?: boolean;
  extraHeaders?: Record<string, string>;
}

async function executeOpenAICompatible(
  options: ExecuteAiOptions,
  config: OpenAICompatibleConfig
): Promise<ExecuteAiResult> {
  const model = options.model?.trim() || config.defaultModel;
  const apiKey = options.apiKey?.trim() || config.envKey;
  const baseUrl = (options.baseUrl?.trim() || config.defaultBaseUrl || '').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error(
      `No base URL configured for ${config.providerName}. Please provide a base URL in AI & Model Settings.`
    );
  }

  if (!apiKey && !config.isLocal) {
    throw new Error(
      `No API key provided for ${config.providerName}. Please add your API key in AI & Model Settings.`
    );
  }

  // Build message list
  const messages: { role: string; content: string }[] = [];

  let effectiveSystemPrompt = options.systemPrompt || '';
  if (options.jsonResponse && effectiveSystemPrompt) {
    effectiveSystemPrompt +=
      '\n\nIMPORTANT: Respond with pure, valid JSON. Do not include extra conversational text outside the JSON.';
  } else if (options.jsonResponse && !effectiveSystemPrompt) {
    effectiveSystemPrompt = 'Respond with pure, valid JSON.';
  }

  if (effectiveSystemPrompt) {
    messages.push({ role: 'system', content: effectiveSystemPrompt });
  }

  if (options.messages && options.messages.length > 0) {
    for (const msg of options.messages) {
      if (msg.role === 'system' && !effectiveSystemPrompt) {
        messages.push(msg);
      } else if (msg.role !== 'system') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  } else if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }

  const body: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
  };

  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  // Certain models support json_object mode
  if (options.jsonResponse && !config.isLocal) {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(config.extraHeaders || {}),
  };

  const endpoint = `${baseUrl}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorDetail = errorText;
      try {
        const parsedErr = JSON.parse(errorText);
        errorDetail = parsedErr.error?.message || parsedErr.message || errorText;
      } catch {
        // use raw text
      }

      if (res.status === 401) {
        throw new Error(
          `${config.providerName} authentication failed (401 Unauthorized). Please verify your API key in Settings.`
        );
      } else if (res.status === 429) {
        throw new Error(
          `${config.providerName} rate limit or quota exceeded (429). Please check your billing or switch models.`
        );
      } else if (res.status === 404) {
        throw new Error(
          `Model "${model}" not found on ${config.providerName} (404). Please verify the model identifier.`
        );
      }

      throw new Error(`${config.providerName} error (${res.status}): ${errorDetail}`);
    }

    const data: any = await res.json();
    const replyText = data.choices?.[0]?.message?.content || '';

    return {
      text: replyText,
      provider: options.provider || 'openai',
      model,
    };
  } catch (err: any) {
    if (config.isLocal && err.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to local AI server at ${baseUrl}. Ensure Ollama or LM Studio is running on your machine.`
      );
    }
    throw err;
  }
}

/**
 * Anthropic Messages API Execution
 */
async function executeAnthropic(options: ExecuteAiOptions): Promise<ExecuteAiResult> {
  const anthropicInfo = getProviderInfo('anthropic');
  const model = options.model?.trim() || anthropicInfo.defaultModel;
  const apiKey =
    options.apiKey?.trim() ||
    (anthropicInfo.envKeyName ? process.env[anthropicInfo.envKeyName] : undefined);

  if (!apiKey) {
    throw new Error(
      'No Anthropic API key provided. Please add your Anthropic key in AI & Model Settings.'
    );
  }

  let system = options.systemPrompt || '';
  if (options.jsonResponse) {
    system += '\n\nIMPORTANT: You MUST respond ONLY with valid, raw JSON. Do not include markdown code fence formatting or commentary.';
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  if (options.messages && options.messages.length > 0) {
    for (const m of options.messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  } else if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }

  // Anthropic requires at least 1 message
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Hello' });
  }

  const body: any = {
    model,
    max_tokens: options.maxTokens || 4096,
    messages,
    temperature: options.temperature ?? 0.7,
  };

  if (system.trim()) {
    body.system = system.trim();
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorDetail = errorText;
    try {
      const parsedErr = JSON.parse(errorText);
      errorDetail = parsedErr.error?.message || errorText;
    } catch {
      // ignore
    }

    if (res.status === 401) {
      throw new Error('Anthropic authentication failed (401). Please check your API key.');
    } else if (res.status === 429) {
      throw new Error('Anthropic rate limit exceeded (429). Please try again shortly.');
    }
    throw new Error(`Anthropic error (${res.status}): ${errorDetail}`);
  }

  const data: any = await res.json();
  const replyText = data.content?.[0]?.text || '';

  return {
    text: replyText,
    provider: 'anthropic',
    model,
  };
}

export interface LiveModelItem {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isVisionCapable?: boolean;
}

/**
 * Programmatically fetch live model offerings directly from the provider's API.
 * This ensures users can dynamically discover brand-new or account-specific models.
 */
export async function fetchLiveProviderModels(options: {
  provider: AIProviderId;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{
  success: boolean;
  provider: AIProviderId;
  models: LiveModelItem[];
  error?: string;
}> {
  const provider = options.provider;

  try {
    switch (provider) {
      case 'gemini': {
        const key = options.apiKey?.trim() || process.env.GEMINI_API_KEY;
        if (!key) {
          return {
            success: false,
            provider,
            models: [],
            error: 'No Gemini API key available. Enter an API key to inspect live models.',
          };
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google Gemini API responded with status ${res.status}: ${errText.slice(0, 120)}`);
        }

        const data: any = await res.json();
        const rawModels: any[] = data.models || [];
        const models: LiveModelItem[] = rawModels
          .filter((m) => {
            const methods: string[] = m.supportedGenerationMethods || [];
            return methods.includes('generateContent');
          })
          .map((m) => {
            const id = m.name?.replace(/^models\//, '') || '';
            const isVision = id.includes('flash') || id.includes('pro') || id.includes('vision') || id.includes('gemma');
            return {
              id,
              name: m.displayName || id,
              description: m.description || '',
              contextWindow: m.inputTokenLimit,
              isVisionCapable: isVision,
            };
          });

        // Ensure Gemma 4 / Gemma 3 entries are highlighted or present
        const hasGemma = models.some((m) => m.id.toLowerCase().includes('gemma'));
        if (!hasGemma) {
          models.unshift({
            id: 'gemma-4-it',
            name: 'Gemma 4 Instruct (Vision & Multimodal)',
            description: 'Latest Gemma open model tier with multimodal vision capabilities.',
            isVisionCapable: true,
          });
        }

        return { success: true, provider, models };
      }

      case 'openai': {
        const key = options.apiKey?.trim() || process.env.OPENAI_API_KEY;
        if (!key) {
          return {
            success: false,
            provider,
            models: [],
            error: 'No OpenAI API key provided. Please enter your API key.',
          };
        }

        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenAI API error (${res.status}): ${err.slice(0, 100)}`);
        }

        const data: any = await res.json();
        const raw = (data.data || []) as any[];
        const filtered = raw
          .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('chatgpt'))
          .sort((a, b) => (b.created || 0) - (a.created || 0))
          .map((m) => ({
            id: m.id,
            name: m.id,
            description: `OpenAI managed model (created ${m.created ? new Date(m.created * 1000).toLocaleDateString() : 'N/A'})`,
            isVisionCapable: m.id.includes('4o'),
          }));

        return { success: true, provider, models: filtered };
      }

      case 'anthropic': {
        const key = options.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return {
            success: false,
            provider,
            models: [],
            error: 'No Anthropic API key provided. Please enter your API key.',
          };
        }

        // Query Anthropic models endpoint
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
        });

        if (res.ok) {
          const data: any = await res.json();
          const models: LiveModelItem[] = (data.data || []).map((m: any) => ({
            id: m.id,
            name: m.display_name || m.id,
            description: `Anthropic Claude model (type: ${m.type || 'model'})`,
            isVisionCapable: true,
          }));
          return { success: true, provider, models };
        }

        // Fallback to verified active Claude family
        return {
          success: true,
          provider,
          models: [
            { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Hybrid Reasoning Flagship)', isVisionCapable: true },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast & Cheap)', isVisionCapable: true },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', isVisionCapable: true },
          ],
        };
      }

      case 'groq': {
        const key = options.apiKey?.trim() || process.env.GROQ_API_KEY;
        if (!key) {
          return {
            success: false,
            provider,
            models: [],
            error: 'No Groq API key provided. Please enter your API key.',
          };
        }

        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Groq API error (${res.status}): ${err.slice(0, 100)}`);
        }

        const data: any = await res.json();
        const models: LiveModelItem[] = (data.data || [])
          .filter((m: any) => m.active !== false)
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            contextWindow: m.context_window,
            description: `Groq LPU accelerated (context: ${m.context_window || 'N/A'})`,
          }));

        return { success: true, provider, models };
      }

      case 'deepseek': {
        const key = options.apiKey?.trim() || process.env.DEEPSEEK_API_KEY;
        if (!key) {
          return {
            success: false,
            provider,
            models: [],
            error: 'No DeepSeek API key provided. Please enter your API key.',
          };
        }

        const res = await fetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${key}` },
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`DeepSeek API error (${res.status}): ${err.slice(0, 100)}`);
        }

        const data: any = await res.json();
        const models: LiveModelItem[] = (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.id === 'deepseek-reasoner' ? 'DeepSeek R1 Reasoner (Flagship)' : 'DeepSeek V3 Chat (Budget)',
          description: `DeepSeek official endpoint model`,
        }));

        return { success: true, provider, models };
      }

      case 'openrouter': {
        const headers: Record<string, string> = {};
        const key = options.apiKey?.trim() || process.env.OPENROUTER_API_KEY;
        if (key) {
          headers.Authorization = `Bearer ${key}`;
        }

        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenRouter error (${res.status}): ${err.slice(0, 100)}`);
        }

        const data: any = await res.json();
        const models: LiveModelItem[] = (data.data || []).slice(0, 50).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          description: m.description ? `${m.description.slice(0, 90)}...` : '',
          contextWindow: m.context_length,
        }));

        return { success: true, provider, models };
      }

      case 'custom': {
        const baseUrl = (options.baseUrl?.trim() || 'http://localhost:11434/v1').replace(/\/+$/, '');
        const host = baseUrl.replace(/\/v1$/, '');

        // Try Ollama's native /api/tags first.
        //
        // A 200 is NOT sufficient proof this is Ollama. LM Studio, vLLM and
        // most reverse proxies answer 200 with their own body for unknown
        // paths, and the previous code took any 200 as authoritative - so it
        // returned an empty model list and never fell through to the standard
        // endpoint, leaving the picker saying "no models" for servers that
        // were listing models perfectly well one path over. Require the
        // Ollama-shaped payload before believing it.
        try {
          const ollamaRes = await fetch(`${host}/api/tags`);
          if (ollamaRes.ok) {
            const data: any = await ollamaRes.json();
            const tags: any[] = Array.isArray(data?.models) ? data.models : [];
            const looksLikeOllama = tags.length > 0 && typeof tags[0]?.name === 'string';

            if (looksLikeOllama) {
              const models: LiveModelItem[] = tags.map((m: any) => ({
                id: m.name,
                name: m.name,
                description:
                  typeof m.size === 'number'
                    ? `Local Ollama model (${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB)`
                    : 'Local Ollama model',
              }));
              return { success: true, provider, models };
            }
          }
        } catch {
          // Not Ollama, or not reachable on that path: fall through.
        }

        // Try standard OpenAI compatible /models
        const res = await fetch(`${baseUrl}/models`);
        if (!res.ok) {
          throw new Error(`Could not connect to custom endpoint at ${baseUrl}. Ensure your local server (Ollama/LM Studio) is running.`);
        }

        const data: any = await res.json();
        const models: LiveModelItem[] = (Array.isArray(data?.data) ? data.data : []).map(
          (m: any) => ({
            id: m.id,
            name: m.id,
            description: 'Local OpenAI-compatible model',
          })
        );

        if (models.length === 0) {
          return {
            success: false,
            provider,
            models: [],
            error: `${baseUrl} answered but listed no models. If this is Ollama, pull one first, for example "ollama pull llama3.2".`,
          };
        }

        return { success: true, provider, models };
      }

      default:
        return { success: false, provider, models: [], error: 'Unknown provider requested' };
    }
  } catch (err: any) {
    return {
      success: false,
      provider,
      models: [],
      error: err.message || 'Failed to fetch live models from provider',
    };
  }
}
