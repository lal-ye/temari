import express, { Request, Response } from 'express';
import { executeAiRequest, parseStructuredJson, fetchLiveProviderModels, AIProviderId } from './aiProvider.ts';
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, getProviderInfo } from '../shared/aiCatalog.ts';

/** Hosted mode is selected by the deployment entry point. */
export function createApiApp({ hosted = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: hosted ? '4mb' : '50mb' }));
  app.use('/api/ai', (req, res, next) => {
    if (!hosted || req.method !== 'POST') return next();
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'A JSON object is required.' });
    }
    const provider = body.provider || DEFAULT_AI_PROVIDER;
    if (!AI_PROVIDERS.some(p => p.id === provider) || provider === 'custom') {
      return res.status(400).json({ error: 'Hosted Temari supports built-in cloud providers only. Custom/Ollama requires self-hosting.' });
    }
    if (body.baseUrl) {
      return res.status(400).json({ error: 'Custom provider URLs are disabled on hosted Temari. Clear the custom URL in Settings.' });
    }
    if (typeof body.apiKey !== 'string' || !body.apiKey.trim()) {
      return res.status(401).json({ error: 'Bring your own API key: add a provider key in Settings.' });
    }
    for (const field of ['model', 'baseUrl']) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        return res.status(400).json({ error: `${field} must be a string.` });
      }
    }
    next();
  });
  // 1. Health check & Provider Info
  app.get('/api/health', (req: Request, res: Response) => {
    const defaultInfo = getProviderInfo(DEFAULT_AI_PROVIDER);
    res.json({
      status: 'ok',
      appName: 'StudySmart (Temari)',
      hasServerKey: !hosted && !!process.env.GEMINI_API_KEY,
      defaultProvider: defaultInfo.id,
      defaultModel: defaultInfo.defaultModel,
      supportedProviders: AI_PROVIDERS.map((p) => p.id),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ai/providers', (req: Request, res: Response) => {
    res.json({
      providers: AI_PROVIDERS.map(({ id, name, defaultModel }) => ({ id, name, defaultModel })),
    });
  });

  // Test Model Connection (Model Agnostic Ping)
  app.post('/api/ai/test-connection', async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const { provider, model, apiKey, baseUrl } = req.body;
      const result = await executeAiRequest({
        provider: (provider as AIProviderId) || 'gemini',
        model,
        apiKey,
        baseUrl,
        prompt: 'Respond with exactly: "OK: StudySmart connection verified."',
        maxTokens: 50,
      });

      const latencyMs = Date.now() - start;
      res.json({
        success: true,
        providerUsed: result.provider,
        modelUsed: result.model,
        latencyMs,
        reply: result.text.trim(),
      });
    } catch (error: any) {
      const latencyMs = Date.now() - start;
      res.status(400).json({
        success: false,
        error: error?.message || 'Connection test failed',
        latencyMs,
      });
    }
  });

  // 2. Programmatically Discover Live Provider Models
  app.post('/api/ai/fetch-live-models', async (req: Request, res: Response) => {
    try {
      const { provider, apiKey, baseUrl } = req.body;
      const result = await fetchLiveProviderModels({
        provider: (provider as AIProviderId) || 'gemini',
        apiKey,
        baseUrl,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        models: [],
        error: error?.message || 'Failed to fetch live models from provider',
      });
    }
  });

  // 3. Generate Dynamic Notes
  app.post('/api/ai/generate-notes', async (req: Request, res: Response) => {
    try {
      const { material, sourceName, apiKey, provider, model, baseUrl } = req.body;
      if (!material || typeof material !== 'string') {
        return res.status(400).json({ error: 'Material is required' });
      }

      const systemPrompt = `You are an expert pedagogical assistant and academic note organizer.
  Generate comprehensive, visually structured study notes in Markdown format from the course material provided by the student.

  Specifications:
  1. Header Hierarchy: Use # for main title, ## for key modules, ### for concepts.
  2. Comparison Matrix: Include Markdown tables (|...|) comparing contrasting concepts where appropriate.
  3. Callouts: Include blockquotes with tags: > [!NOTE], > [!IMPORTANT], > [!TIP].
  4. Figures: When a diagram teaches more than a paragraph would, emit ONE fenced block of JSON. Temari draws the picture; you supply only the structure.

  \`\`\`diagram
  {"version":1,"type":"loop","title":"Cellular respiration","subtitle":"Each pass yields ATP and feeds the next substrate","hub":{"id":"pool","label":"Cell energy pool","sublabel":"ATP / NADH"},"focal":["etc"],"nodes":[{"id":"glycolysis","label":"Glycolysis","sublabel":"Glucose to pyruvate","tag":"CYTOSOL"},{"id":"pyruvate","label":"Pyruvate oxidation","sublabel":"To acetyl-CoA"},{"id":"krebs","label":"Krebs cycle","sublabel":"Citric acid cycle","tag":"MATRIX"},{"id":"etc","label":"Electron transport","sublabel":"Oxidative phosphorylation","role":"focal"},{"id":"atp","label":"ATP synthesis","sublabel":"30-32 ATP per glucose"}],"edges":[{"from":"glycolysis","to":"pyruvate","label":"PYRUVATE"},{"from":"pyruvate","to":"krebs","label":"ACETYL-COA"},{"from":"krebs","to":"etc","label":"NADH"},{"from":"etc","to":"atp","label":"H+ GRADIENT"},{"from":"atp","to":"glycolysis","label":"ATP","kind":"return"}]}
  \`\`\`

  Figure rules, all mandatory:
  - JSON only inside the fence. Never Mermaid, never SVG, never prose or comments inside the fence.
  - "type" must be one of: loop | tree | process | pyramid.
    Pick loop for cycles that regenerate a substrate or feed a shared pool (a loop MUST have a "hub" naming that pool).
    Pick tree for taxonomy and part-of hierarchies. Pick process for linear stages. Pick pyramid for ranked levels.
  - Budget: at most 9 nodes, 12 edges, 2 focal ids. Aim for 5 to 7 nodes. If the topic needs more, emit an overview figure and a separate detail figure.
  - Lengths, counted in characters: node "label" at most 28, "sublabel" at most 36, edge "label" at most 14 and UPPERCASE, "tag" at most 12.
  - Node ids are kebab-case, unique, and every edge "from"/"to" must match a node id or the hub id.
  - Put the exam-critical concept in "focal". If everything is emphasised, nothing is.
  - Use the subject's real terminology. Do not invent filler nodes to reach a count.
  - If a three-column Markdown table would communicate it better, use a table and emit no figure.
  - Write labels in the language of the note, including Amharic where the source is Amharic.
  - At most one figure per major section.
  5. References: Include a references section at the bottom citing "${sourceName || 'Provided Course Material'}".`;

      const prompt = `Please generate rich study notes based on this source material:\n\n${material}`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
      });

      const notes = result.text || '# Study Notes\n\nCould not generate notes content.';
      res.json({
        notes,
        providerUsed: result.provider,
        modelUsed: result.model,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/generate-notes:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate notes' });
    }
  });

  // 4. Generate Flashcard Quiz
  app.post('/api/ai/generate-quiz', async (req: Request, res: Response) => {
    try {
      const {
        material,
        quizLength = 5,
        difficulty = 'Medium',
        apiKey,
        provider,
        model,
        baseUrl,
      } = req.body;

      if (!material) {
        return res.status(400).json({ error: 'Material is required' });
      }

      const systemPrompt = `You are an expert exam designer.
  Generate a flashcard quiz with ${quizLength} flashcards at difficulty level "${difficulty}" based on the student's material.

  You MUST respond strictly with a valid JSON object conforming to this schema:
  {
    "flashcards": [
      {
        "id": "fc-1",
        "question": "Clear, direct question prompt",
        "answer": "Detailed answer explaining the concept",
        "difficulty": "Easy" | "Medium" | "Hard",
        "tags": ["Topic1", "Topic2"]
      }
    ]
  }`;

      const prompt = `Course Material:\n${material}\n\nGenerate ${quizLength} flashcards at "${difficulty}" difficulty in JSON.`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
        jsonResponse: true,
      });

      const parsed = parseStructuredJson<{ flashcards: any[] }>(result.text, { flashcards: [] });
      res.json({
        flashcards: parsed.flashcards || [],
        providerUsed: result.provider,
        modelUsed: result.model,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/generate-quiz:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate quiz' });
    }
  });

  // 5. Extract Knowledge Units — stage 1 of exam generation (docs/adr/0008)
  //
  // Dumping a whole notes library into one question-writing prompt lets the model
  // over-sample whatever topic happens to appear first. Naming the assessable
  // ideas first, then writing against them, is what makes coverage planned
  // instead of emergent.
  app.post('/api/ai/extract-knowledge-units', async (req: Request, res: Response) => {
    try {
      const { material, maxUnits = 12, apiKey, provider, model, baseUrl } = req.body;

      if (!material) {
        return res.status(400).json({ error: 'Material is required' });
      }

      const cap = Math.max(1, Math.min(Number(maxUnits) || 12, 24));

      const systemPrompt = `You are a curriculum designer. Read the course material and list the discrete knowledge units a student must master — the ideas an exam should actually assess, not section headings copied verbatim.

  For each unit give:
  - "concept": the idea, named in at most 6 words
  - "definition": one sentence stating what it is, grounded in the material
  - "sourceSnippet": a short verbatim passage from the material that supports it

  Rules:
  - Return at most ${cap} units, ordered by how central each is to the material.
  - Merge restatements of the same idea; never return two units that are the same concept worded differently.
  - Every unit must be assessable — something a question can be written about and an answer judged against.
  - Invent nothing: if the material does not support a unit, leave it out.

  You MUST respond strictly with a valid JSON object matching this schema:
  {
    "knowledgeUnits": [
      {
        "id": "ku-1",
        "concept": "Glycolysis",
        "definition": "The ten-step pathway that splits glucose into two pyruvate molecules, yielding net 2 ATP.",
        "sourceSnippet": "Glycolysis occurs in the cytosol and produces a net gain of two ATP..."
      }
    ]
  }`;

      const prompt = `Course Material:\n${material}\n\nList up to ${cap} knowledge units in JSON.`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
        jsonResponse: true,
      });

      const parsed = parseStructuredJson<{ knowledgeUnits: any[] }>(result.text, { knowledgeUnits: [] });

      // Normalise on the way out: the model owns the wording, the server owns the
      // shape, so downstream code never has to defend against a missing field.
      const knowledgeUnits = (Array.isArray(parsed.knowledgeUnits) ? parsed.knowledgeUnits : [])
        .slice(0, cap)
        .map((unit, idx) => ({
          id: typeof unit?.id === 'string' && unit.id.trim() ? unit.id.trim() : `ku-${idx + 1}`,
          concept: String(unit?.concept ?? '').trim().slice(0, 120),
          definition: String(unit?.definition ?? '').trim().slice(0, 400),
          sourceSnippet:
            typeof unit?.sourceSnippet === 'string' ? unit.sourceSnippet.trim().slice(0, 400) : undefined,
        }))
        .filter((unit) => unit.concept.length > 0);

      res.json({ knowledgeUnits, providerUsed: result.provider, modelUsed: result.model });
    } catch (error: any) {
      console.error('Error in /api/ai/extract-knowledge-units:', error);
      res.status(500).json({ error: error?.message || 'Failed to extract knowledge units' });
    }
  });

  /** Bloom level names as the prompt states them, so the model cannot reinterpret the label. */
  const BLOOM_PROMPT_LABELS: Record<string, string> = {
    remember: 'Remember — recall a specific fact, term or definition',
    understand: 'Understand — explain, summarise or classify an idea in the student’s own terms',
    analyze: 'Analyze — break a whole into parts and relate them (compare, contrast, differentiate)',
    evaluate: 'Evaluate — judge, critique or defend a position with criteria',
    create: 'Create — produce a new plan, design or formulation from the material',
    apply: 'Apply — use a rule or method in a situation the material did not spell out',
  };

  /**
   * Render the client-computed cognitive plan (src/services/examBlueprint.ts)
   * into the prompt lines that demand it. The client owns the quota; this route
   * owns the words. Keeping them on opposite sides of one request body is what
   * stops the plan and the prompt from drifting apart.
   */
  function renderBloomPlan(plan: Array<{ level: string; verb?: string; count: number }>): string {
    return plan
      .filter((slot) => slot && slot.count > 0)
      .map((slot) => {
        const label = BLOOM_PROMPT_LABELS[slot.level] ?? slot.level;
        const verbs = typeof slot.verb === 'string' && slot.verb ? slot.verb : '';
        return `- ${slot.count} question${slot.count === 1 ? '' : 's'} at "${slot.level}": ${label}${
          verbs ? `. Start the stem with a verb such as: ${verbs}.` : '.'
        }`;
      })
      .join('\n');
  }

  // 6. Generate Comprehensive Exam
  app.post('/api/ai/generate-exam', async (req: Request, res: Response) => {
    try {
      const {
        material,
        numberOfQuestions = 15,
        bloomPlan,
        knowledgeUnits,
        avoidStems,
        apiKey,
        provider,
        model,
        baseUrl,
      } = req.body;

      if (!material) {
        return res.status(400).json({ error: 'Material is required' });
      }

      const total = Math.max(1, Math.min(Number(numberOfQuestions) || 15, 40));
      const plan = Array.isArray(bloomPlan) ? bloomPlan : [];
      const units = Array.isArray(knowledgeUnits) ? knowledgeUnits : [];
      const avoid = Array.isArray(avoidStems) ? avoidStems.slice(0, 60) : [];

      // A format is not a cognitive level: an MCQ can be pure recall or deep
      // analysis. The distribution below is the part of this prompt that decides
      // what the learner actually practises.
      const distributionSection = plan.length
        ? `Cognitive level distribution — this is mandatory, not advisory:
  ${renderBloomPlan(plan)}

  Write each question at its assigned level and nowhere else. A "remember" question must not ask the student to justify anything; a "create" question must not be answerable by reciting a definition. If a knowledge unit will not support a high level, pick another unit — do not quietly downgrade the question.`
        : `Spread the ${total} questions across cognitive levels rather than asking ${total} recall questions.`;

      const unitsSection = units.length
        ? `Knowledge units to assess (write against these, and cover as many as the question count allows):
  ${units
    .map((u: any, i: number) => `${i + 1}. [${u.id}] ${u.concept} — ${u.definition ?? ''}`)
    .join('\n')}

  Set "knowledgeUnitId" on every question to the unit it was written against. Do not write two questions about the same unit unless the question count forces it, and never let one unit dominate the exam just because it appears most often in the material.`
        : '';

      const avoidSection = avoid.length
        ? `The student has already answered questions like these. Do not repeat them or reword them — write about different material or ask at a different cognitive level:
  ${avoid.map((s: string) => `- ${String(s).slice(0, 160)}`).join('\n')}`
        : '';

      const systemPrompt = `You are a university professor writing a mock exam that tests understanding, not memorisation.

  Write exactly ${total} questions.

  ${distributionSection}

  ${unitsSection}

  ${avoidSection}

  Question formats:
  - Multiple choice (type: "multiple_choice", "options": exactly 4 distinct strings)
  - True / False (type: "true_false", "options": ["true", "false"])
  - Short Answer (type: "short_answer", "options" omitted)

  For every question:
  - "topic" is the knowledge unit's concept, or the closest heading in the material. Never invent a topic the material does not contain.
  - "explanation" must say why the answer is correct AND quote or name the specific passage in the material it comes from, so the student can find it in their own notes.
  - For "short_answer", add "rubric": 2-4 short statements naming the points that earn full credit. Grading is done against this rubric, so make the points checkable, not vibes.
  - For "multiple_choice", make distractors plausible misconceptions a real student would hold, not obviously wrong filler. Exactly one option may be correct.
  - Vary which option position holds the correct answer across the exam. Do not default to the first or second option.
  - No two questions may ask the same thing, even worded differently.

  You MUST respond strictly with a valid JSON object matching this schema:
  {
    "exam": [
      {
        "id": "q-1",
        "question": "Question text",
        "type": "multiple_choice" | "true_false" | "short_answer",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Exact string of correct answer",
        "explanation": "Why this answer is correct, citing the passage in the material",
        "topic": "Topic Name",
        "bloomLevel": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
        "knowledgeUnitId": "ku-1",
        "rubric": ["Point 1", "Point 2"]
      }
    ]
  }

  "bloomLevel" is required on every question and must match the level you were assigned for it. "rubric" is required on short_answer questions and omitted elsewhere.`;

      const prompt = `Course Material:\n${material}\n\nWrite the ${total} exam questions in JSON.`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
        jsonResponse: true,
      });

      const parsed = parseStructuredJson<{ exam: any[] }>(result.text, { exam: [] });
      res.json({
        exam: parsed.exam || [],
        providerUsed: result.provider,
        modelUsed: result.model,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/generate-exam:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate exam' });
    }
  });

  // 7. Grade Exam & Analyze
  app.post('/api/ai/grade-exam', async (req: Request, res: Response) => {
    try {
      const { exam, userAnswers, apiKey, provider, model, baseUrl } = req.body;
      if (!exam || !Array.isArray(exam)) {
        return res.status(400).json({ error: 'Exam questions are required' });
      }

      const systemPrompt = `You are an expert exam grader.
  Grade the student answers against the exam questions.

  Grading rules:
  - Multiple choice and true/false: correct only if the answer matches "correctAnswer".
  - Short answer: grade against that question's "rubric", point by point. List the points the answer actually earned in "rubricEarned". The answer is "isCorrect" when it earns at least half the rubric points. Do not award a point for wording that merely resembles the rubric - the student must state the idea.
  - Judge the answer at the cognitive level the question asks for ("bloomLevel"). A recall-level answer that recites a definition does not earn credit on an "analyze" or "evaluate" question.

  Carry "topic", "bloomLevel" and "knowledgeUnitId" through verbatim from the question object - do not restate, rename or invent them. Mastery is measured per topic and per cognitive level, so a changed string corrupts the student's history.

  Return a strict JSON object with:
  1. results: Array of results for each question, one per question, in the same order
  2. overallScore: integer percentage 0-100
  3. topicsToReview: array of topic strings where student made mistakes
  4. extraReadings: array of 2-4 recommended article objects { title: string, url: string, snippet: string }

  Schema:
  {
    "results": [
      {
        "question": "string",
        "type": "multiple_choice" | "true_false" | "short_answer",
        "correctAnswer": "string",
        "userAnswer": "string",
        "isCorrect": boolean,
        "explanation": "string",
        "topic": "string",
        "bloomLevel": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
        "knowledgeUnitId": "string",
        "rubricEarned": ["string"]
      }
    ],
    "overallScore": 85,
    "topicsToReview": ["Topic A", "Topic B"],
    "extraReadings": [
      { "title": "Understanding Topic A", "url": "https://example.com/topic-a", "snippet": "Overview description" }
    ]
  }`;

      const prompt = `Exam Questions:
  ${JSON.stringify(exam, null, 2)}

  Student User Answers:
  ${JSON.stringify(userAnswers || [], null, 2)}

  Grade and return JSON evaluation.`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
        jsonResponse: true,
      });

      const parsed = parseStructuredJson(result.text, {
        results: [],
        overallScore: 0,
        topicsToReview: [],
        extraReadings: [],
      });

      res.json({
        ...parsed,
        providerUsed: result.provider,
        modelUsed: result.model,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/grade-exam:', error);
      res.status(500).json({ error: error?.message || 'Failed to grade exam' });
    }
  });

  // 8. Explain Term
  app.post('/api/ai/explain-term', async (req: Request, res: Response) => {
    try {
      const { term, context, apiKey, provider, model, baseUrl } = req.body;
      if (!term) return res.status(400).json({ error: 'Term is required' });

      const systemPrompt = `You are a helpful educational assistant.
  Provide a concise, easy-to-understand explanation in Markdown for the student learning term: "${term}".
  ${context ? `Context: "${context}"` : ''}

  Include 1-2 curated educational references or search links.

  Respond with strict JSON:
  {
    "explanation": "Clear markdown explanation...",
    "relatedLinks": [
      { "title": "Resource title", "url": "https://...", "snippet": "Description" }
    ]
  }`;

      const prompt = `Explain term "${term}" in JSON format.`;

      const result = await executeAiRequest({
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        prompt,
        jsonResponse: true,
      });

      const parsed = parseStructuredJson(result.text, {
        explanation: `**${term}**: Definition unavailable.`,
        relatedLinks: [],
      });

      res.json({
        ...parsed,
        providerUsed: result.provider,
        modelUsed: result.model,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/explain-term:', error);
      res.status(500).json({ error: error?.message || 'Failed to explain term' });
    }
  });

  // Helper to extract text locally from the PDF data URI using pdf-parse
  async function extractTextLocally(dataUri: string): Promise<string> {
    try {
      const matches = dataUri.match(/^data:(.+?);base64,(.+)$/);
      const base64Data = matches ? matches[2] : dataUri.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();
      return (textResult?.text || '').trim();
    } catch (localErr) {
      console.warn('Local PDF parser attempt failed:', localErr);
      return '';
    }
  }

  // 9. Extract Text from PDF (Multimodal with local PDFParse fallback)
  app.post('/api/ai/extract-pdf', async (req: Request, res: Response) => {
    try {
      const { pdfDataUri, apiKey, provider, model, baseUrl } = req.body;
      if (!pdfDataUri || typeof pdfDataUri !== 'string') {
        return res.status(400).json({ error: 'pdfDataUri is required' });
      }

      let extractedText = '';
      let providerUsed = provider || 'gemini';
      let modelUsed = model || '';

      const activeProvider: AIProviderId = (provider as AIProviderId) || 'gemini';
      const activeModel: string = model?.trim() || '';

      if (activeProvider === 'gemini') {
        // Multimodal Gemini extraction directly with user's selected active model
        try {
          const result = await executeAiRequest({
            provider: 'gemini',
            model: activeModel || undefined,
            apiKey,
            baseUrl,
            pdfDataUri,
            prompt:
              'Extract all textual content from this PDF document thoroughly. Output only the clean extracted text and notes without conversational introductions.',
          });

          extractedText = result.text || '';
          providerUsed = result.provider;
          modelUsed = result.model;
        } catch (aiError: any) {
          console.warn(
            'Gemini extraction error, trying local PDF parser fallback:',
            aiError?.message || aiError
          );
          const localExtracted = await extractTextLocally(pdfDataUri);
          if (localExtracted && localExtracted.length > 20) {
            extractedText = localExtracted;
            providerUsed = 'local-pdf-parser';
            modelUsed = 'pdf-parse';
          } else {
            throw aiError;
          }
        }
      } else {
        // For OpenAI, Anthropic, Groq, DeepSeek, Ollama: parse PDF text locally first
        const localExtracted = await extractTextLocally(pdfDataUri);
        if (!localExtracted || localExtracted.length < 10) {
          throw new Error('Could not extract textual content from uploaded PDF document.');
        }

        // Format and clean up text with user's selected active model
        try {
          const result = await executeAiRequest({
            provider: activeProvider,
            model: activeModel || undefined,
            apiKey,
            baseUrl,
            prompt: `You are an expert academic assistant. Here is raw extracted text from study material:\n\n${localExtracted.slice(0, 50000)}\n\nClean up and format this text into clear, readable study content without omitting key facts. Output only the structured study text.`,
          });
          extractedText = result.text || localExtracted;
          providerUsed = result.provider;
          modelUsed = result.model;
        } catch (formatErr) {
          console.warn('Cleanup with active model failed, using direct extracted text:', formatErr);
          extractedText = localExtracted;
          providerUsed = 'local-pdf-parser';
          modelUsed = 'pdf-parse';
        }
      }

      res.json({
        extractedText,
        providerUsed,
        modelUsed,
      });
    } catch (error: any) {
      console.error('Error in /api/ai/extract-pdf:', error);
      res.status(500).json({ error: error?.message || 'Failed to extract PDF' });
    }
  });


  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found' }); });
  app.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Request too large. Use a smaller PDF or split your material (4 MiB JSON limit on hosted deployments).' : status === 400 ? 'Invalid JSON request.' : 'Internal server error.' });
  });
  return app;
}
