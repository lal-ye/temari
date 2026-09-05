import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  executeAiRequest,
  parseStructuredJson,
  fetchLiveProviderModels,
  AIProviderId,
} from './server/aiProvider.ts';
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, getProviderInfo } from './shared/aiCatalog.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Support large payload for PDF extraction data URIs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Health check & Provider Info
app.get('/api/health', (req: Request, res: Response) => {
  const defaultInfo = getProviderInfo(DEFAULT_AI_PROVIDER);
  res.json({
    status: 'ok',
    appName: 'StudySmart (Temari)',
    hasServerKey: !!process.env.GEMINI_API_KEY,
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
4. Concept Diagram: Generate an editorial concept map or process diagram using \`\`\`diagram \\n root((Core Subject)) \\n   Branch Name \\n     Sub-concept 1 \\n     Sub-concept 2 \\n \`\`\`. Do NOT use Mermaid syntax or external library tags; use clean indented structure for Temari's native editorial vector diagram system.
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

// 3. Generate Flashcard Quiz
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

// 4. Generate Comprehensive Exam
app.post('/api/ai/generate-exam', async (req: Request, res: Response) => {
  try {
    const {
      material,
      numberOfQuestions = 15,
      apiKey,
      provider,
      model,
      baseUrl,
    } = req.body;

    if (!material) {
      return res.status(400).json({ error: 'Material is required' });
    }

    const systemPrompt = `You are a university professor creating an exam.
Generate an exam with ${numberOfQuestions} questions based on this course material.
Mix question types:
- Multiple choice (type: "multiple_choice", options: 4 distinct strings)
- True / False (type: "true_false", options: ["true", "false"])
- Short Answer (type: "short_answer", options omitted)

You MUST respond strictly with a valid JSON object matching this schema:
{
  "exam": [
    {
      "id": "q-1",
      "question": "Question text",
      "type": "multiple_choice" | "true_false" | "short_answer",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact string of correct answer",
      "explanation": "Why this answer is correct",
      "topic": "Topic Name"
    }
  ]
}`;

    const prompt = `Course Material:\n${material}\n\nGenerate ${numberOfQuestions} exam questions in JSON.`;

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

// 5. Grade Exam & Analyze
app.post('/api/ai/grade-exam', async (req: Request, res: Response) => {
  try {
    const { exam, userAnswers, apiKey, provider, model, baseUrl } = req.body;
    if (!exam || !Array.isArray(exam)) {
      return res.status(400).json({ error: 'Exam questions are required' });
    }

    const systemPrompt = `You are an expert exam grader.
Grade the student answers against the exam questions.

Return a strict JSON object with:
1. results: Array of results for each question with { question, type, correctAnswer, userAnswer, isCorrect: boolean, explanation, topic }
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
      "topic": "string"
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

// 6. Explain Term
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

// 7. Extract Text from PDF (Multimodal with local PDFParse fallback)
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

// Vite middleware / production serving
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudySmart server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic();

