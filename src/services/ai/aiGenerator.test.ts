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

  describe('fallback reason (provenance ≠ reason)', () => {
    function fetchFail(status: number, error: string) {
      return vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => JSON.stringify({ error }),
        json: async () => ({ error }),
      });
    }

    it('a rejected key is reported as bad-key, naming the Provider', async () => {
      vi.stubGlobal('fetch', fetchFail(401, 'Incorrect API key provided'));

      const result = await makeGenerator().generateNotes({ material });

      expect(result.source).toBe('offline');
      expect(result.fallback?.kind).toBe('bad-key');
      expect(result.fallback?.provider).toBe('OpenAI');
      expect(result.fallback?.detail).toBe('Incorrect API key provided');
    });

    it('a rate limit is reported as rate-limited', async () => {
      vi.stubGlobal('fetch', fetchFail(429, 'Rate limit reached for requests'));

      const result = await makeGenerator().generateQuiz({ material, quizLength: 3, difficulty: 'Easy' });

      expect(result.fallback?.kind).toBe('rate-limited');
    });

    it('a browser fetch TypeError is reported as no-server (Temari server unreachable)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const result = await makeGenerator().explainTerm({ term: 'Osmosis' });

      expect(result.source).toBe('offline');
      expect(result.fallback?.kind).toBe('no-server');
    });

    it('an unknown model is reported as unknown-model', async () => {
      vi.stubGlobal('fetch', fetchFail(404, 'The model `gpt-9` does not exist'));

      const result = await makeGenerator().generateExam({ material });

      expect(result.fallback?.kind).toBe('unknown-model');
    });

    it('a missing key on a cloud Provider is reported as missing-key', async () => {
      vi.stubGlobal('fetch', fetchFail(401, 'API key missing'));
      const noKey = createAiGenerator({
        getSettings: () => ({ selectedProvider: 'openai' as const, selectedModel: 'gpt-4o-mini', providerKeys: {} }),
      });

      const result = await noKey.generateNotes({ material });

      expect(result.fallback?.kind).toBe('missing-key');
    });

    it('a model result carries no fallback', async () => {
      vi.stubGlobal('fetch', fetchOk({ notes: '# Real' }));

      const result = await makeGenerator().generateNotes({ material });

      expect(result.source).toBe('model');
      expect(result.fallback).toBeUndefined();
    });

    it('the signal reaches fetch', async () => {
      const fetchMock = fetchOk({ notes: '# Real' });
      vi.stubGlobal('fetch', fetchMock);
      const controller = new AbortController();

      await makeGenerator().generateNotes({ material, signal: controller.signal });

      expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    });
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

  it('sends the cognitive plan and knowledge units to the server, not just a count', async () => {
    const fetchMock = fetchOk({ exam: [] });
    vi.stubGlobal('fetch', fetchMock);

    const plan = [
      { level: 'remember' as const, verb: 'define, list', count: 3 },
      { level: 'analyze' as const, verb: 'compare, contrast', count: 2 },
    ];
    const units = [
      { id: 'ku-1', concept: 'Glycolysis', definition: 'Splits glucose into pyruvate.' },
    ];

    await makeGenerator().generateExam({
      material,
      numberOfQuestions: 5,
      bloomPlan: plan,
      knowledgeUnits: units,
      avoidStems: ['Define glycolysis.'],
    });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/ai/generate-exam');
    const body = JSON.parse(init.body);
    // The quota and the units travel with the request, so the server prompt can
    // hold the model to a distribution instead of hoping for one.
    expect(body.bloomPlan).toEqual(plan);
    expect(body.knowledgeUnits).toEqual(units);
    expect(body.avoidStems).toEqual(['Define glycolysis.']);
  });

  it('extracts knowledge units through the server when it is reachable', async () => {
    const fetchMock = fetchOk({
      knowledgeUnits: [{ id: 'ku-1', concept: 'Photosynthesis', definition: 'Light to chemical energy.' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeGenerator().extractKnowledgeUnits({ material, maxUnits: 8 });

    expect(result.source).toBe('model');
    expect(result.value).toHaveLength(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/ai/extract-knowledge-units');
    expect(JSON.parse(init.body).maxUnits).toBe(8);
  });

  it('falls back to structural extraction when no Provider is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await makeGenerator().extractKnowledgeUnits({
      material: [
        '# Glycolysis',
        '',
        'Glycolysis splits one glucose molecule into two pyruvate molecules in the cytosol.',
        '',
        '## Krebs Cycle',
        '',
        'The Krebs cycle oxidises acetyl-CoA and releases carbon dioxide as waste.',
      ].join('\n'),
    });

    expect(result.source).toBe('offline');
    expect(result.value.map((u) => u.concept)).toEqual(['Glycolysis', 'Krebs Cycle']);
    // Each unit carries the passage it came from, so a question can cite it.
    expect(result.value[0].sourceSnippet).toContain('pyruvate');
  });

  it('extracts units from heading-less pasted text by falling back to sentences', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await makeGenerator().extractKnowledgeUnits({
      material:
        'Glycolysis occurs in the cytosol and yields a net gain of two ATP molecules per glucose. ' +
        'The Krebs cycle takes place in the mitochondrial matrix and releases carbon dioxide.',
    });

    expect(result.value).toHaveLength(2);
    expect(result.value[0].id).toBe('ku-1');
  });

  it('labels every offline exam question as recall rather than claiming a level it cannot reach', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await makeGenerator().generateExam({
      material: 'Glycolysis occurs in the cytosol and yields a net gain of two ATP molecules per glucose molecule.',
      numberOfQuestions: 6,
    });

    expect(result.source).toBe('offline');
    expect(result.value.length).toBe(6);
    // Sentence extraction cannot produce analysis or synthesis. Claiming it can
    // would make the mastery dashboard lie about what was practised.
    result.value.forEach((q) => expect(q.bloomLevel).toBe('remember'));
  });

  it('scores offline short answers against the rubric, point by point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const exam = [
      {
        question: 'Explain glycolysis.',
        type: 'short_answer' as const,
        correctAnswer: 'It splits glucose into pyruvate, yielding ATP.',
        topic: 'Glycolysis',
        bloomLevel: 'remember' as const,
        rubric: ['Names glucose as the substrate', 'States that pyruvate is produced', 'Mentions the ATP yield'],
      },
    ];

    const partial = await makeGenerator().gradeExam({
      exam,
      userAnswers: ['Glucose is broken down to produce pyruvate.'],
    });
    expect(partial.value.results[0].rubricEarned).toEqual([
      'Names glucose as the substrate',
      'States that pyruvate is produced',
    ]);
    expect(partial.value.results[0].isCorrect).toBe(true);
    // The level survives grading, or the mastery grid loses its second axis.
    expect(partial.value.results[0].bloomLevel).toBe('remember');

    const empty = await makeGenerator().gradeExam({ exam, userAnswers: ['hmm'] });
    expect(empty.value.results[0].rubricEarned).toEqual([]);
    expect(empty.value.results[0].isCorrect).toBe(false);
  });

  it('applies the offline quiz length clamp (min 3)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const quiz = await makeGenerator().generateQuiz({ material, quizLength: 2, difficulty: 'Hard' });

    expect(quiz.source).toBe('offline');
    expect(quiz.value.length).toBe(3);
  });
});
