import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiGenerator } from './index';

/**
 * Interface tests for the AI-Generation module. The port is the test surface:
 * these describe observable behaviour (credentials resolution, fallback
 * policy, attribution) — not adapter internals — so they survive refactors.
 */

const settings = {
  selectedProvider: 'openai' as const,
  selectedModel: 'gpt-4o-mini',
  providerKeys: { openai: 'sk-test-key' },
};

const material = 'Photosynthesis converts light energy into chemical energy stored in ATP.';

function makeGenerator() {
  return createAiGenerator({ getSettings: () => settings });
}

function fetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AiGenerator', () => {
  it('returns model output with source "model" when the server responds', async () => {
    const fetchMock = fetchOk({ notes: '# Real AI notes' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeGenerator().generateNotes({ material, sourceName: 'Lecture 1' });

    expect(result.source).toBe('model');
    expect(result.value).toBe('# Real AI notes');

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/ai/generate-notes');
    const body = JSON.parse(init.body);
    // credentials resolved from settings inside the module, not passed by callers
    expect(body.provider).toBe('openai');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.apiKey).toBe('sk-test-key');
    expect(body.material).toBe(material);
    expect(body.sourceName).toBe('Lecture 1');
  });

  it('falls back to the offline adapter with source "offline" on HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'provider exploded' }),
        json: async () => ({ error: 'provider exploded' }),
      })
    );

    const result = await makeGenerator().generateNotes({ material });

    expect(result.source).toBe('offline');
    expect(typeof result.value).toBe('string');
    expect(result.value).toContain('Offline Draft');
  });

  it('falls back offline on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const quiz = await makeGenerator().generateQuiz({ material, quizLength: 5, difficulty: 'Easy' });

    expect(quiz.source).toBe('offline');
    expect(quiz.value.length).toBe(5);
    expect(quiz.value[0].question).toContain('what is the primary mechanism');
  });

  it('propagates user aborts instead of substituting offline content', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(makeGenerator().generateExam({ material })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('grades offline when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await makeGenerator().gradeExam({
      exam: [
        {
          question: '2+2?',
          type: 'multiple_choice',
          options: ['4', '5', '6', '7'],
          correctAnswer: '4',
          topic: 'Arithmetic',
        },
      ],
      userAnswers: ['4'],
    });

    expect(result.source).toBe('offline');
    expect(result.value.overallScore).toBe(100);
    expect(result.value.results[0].isCorrect).toBe(true);
  });

  it('explains terms offline when no Provider is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await makeGenerator().explainTerm({ term: 'Osmosis' });

    expect(result.source).toBe('offline');
    expect(result.value.explanation).toContain('**Osmosis**');
    expect(result.value.relatedLinks?.length).toBeGreaterThan(0);
  });

  it('applies the offline quiz length clamp (min 3)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const quiz = await makeGenerator().generateQuiz({ material, quizLength: 2, difficulty: 'Hard' });

    expect(quiz.source).toBe('offline');
    expect(quiz.value.length).toBe(3);
  });
});
