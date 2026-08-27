import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Support large payload for PDF extraction data URIs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to get GoogleGenAI instance
function getAI(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'StudySmart (Temari)',
    hasServerKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// 2. Generate Dynamic Notes
app.post('/api/ai/generate-notes', async (req: Request, res: Response) => {
  try {
    const { material, sourceName, apiKey } = req.body;
    if (!material || typeof material !== 'string') {
      return res.status(400).json({ error: 'Material is required' });
    }

    const ai = getAI(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'No Gemini API key available. Please provide an API key in Settings.' });
    }

    const prompt = `You are an expert pedagogical assistant and academic note organizer.
Generate comprehensive, visually structured study notes in Markdown format from the following course material.

Specifications:
1. Header Hierarchy: Use # for main title, ## for key modules, ### for concepts.
2. Comparison Matrix: Include Markdown tables (|...|) comparing contrasting concepts.
3. Callouts: Include blockquotes with tags: > [!NOTE], > [!IMPORTANT], > [!TIP].
4. Mindmap Diagram: Generate a VALID Mermaid.js mindmap diagram using \`\`\`mermaid \\n mindmap \\n root((Title)) ... \`\`\`. Ensure proper indentation without syntax errors.
5. References: Include a references section at the bottom citing "${sourceName || 'Provided Course Material'}".

Source Material:
${material}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const notes = response.text || '# Study Notes\n\nCould not generate notes content.';
    res.json({ notes });
  } catch (error: any) {
    console.error('Error in /api/ai/generate-notes:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate notes' });
  }
});

// 3. Generate Flashcard Quiz
app.post('/api/ai/generate-quiz', async (req: Request, res: Response) => {
  try {
    const { material, quizLength = 5, difficulty = 'Medium', apiKey } = req.body;
    if (!material) {
      return res.status(400).json({ error: 'Material is required' });
    }

    const ai = getAI(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'No Gemini API key available' });
    }

    const prompt = `Generate a flashcard quiz with ${quizLength} flashcards at difficulty level "${difficulty}" based on the following material:

Material:
${material}

You MUST respond strictly with valid JSON conforming to this schema:
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
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    res.json({ flashcards: parsed.flashcards || [] });
  } catch (error: any) {
    console.error('Error in /api/ai/generate-quiz:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate quiz' });
  }
});

// 4. Generate Comprehensive Exam
app.post('/api/ai/generate-exam', async (req: Request, res: Response) => {
  try {
    const { material, numberOfQuestions = 15, apiKey } = req.body;
    if (!material) {
      return res.status(400).json({ error: 'Material is required' });
    }

    const ai = getAI(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'No Gemini API key available' });
    }

    const prompt = `You are a university professor creating an exam.
Generate an exam with ${numberOfQuestions} questions based on this course material.
Mix question types:
- Multiple choice (type: "multiple_choice", options: 4 distinct strings)
- True / False (type: "true_false", options: ["true", "false"])
- Short Answer (type: "short_answer", options omitted)

Material:
${material}

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
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    res.json({ exam: parsed.exam || [] });
  } catch (error: any) {
    console.error('Error in /api/ai/generate-exam:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate exam' });
  }
});

// 5. Grade Exam & Analyze
app.post('/api/ai/grade-exam', async (req: Request, res: Response) => {
  try {
    const { exam, userAnswers, apiKey } = req.body;
    if (!exam || !Array.isArray(exam)) {
      return res.status(400).json({ error: 'Exam questions are required' });
    }

    const ai = getAI(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'No Gemini API key available' });
    }

    const prompt = `You are an expert exam grader.
Grade the following student answers against the exam questions.

Exam Questions:
${JSON.stringify(exam, null, 2)}

Student User Answers (in matching index order):
${JSON.stringify(userAnswers || [], null, 2)}

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
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/grade-exam:', error);
    res.status(500).json({ error: error?.message || 'Failed to grade exam' });
  }
});

// 6. Explain Term
app.post('/api/ai/explain-term', async (req: Request, res: Response) => {
  try {
    const { term, context, apiKey } = req.body;
    if (!term) return res.status(400).json({ error: 'Term is required' });

    const ai = getAI(apiKey);
    if (!ai) return res.status(400).json({ error: 'No Gemini API key available' });

    const prompt = `Provide a concise, easy-to-understand explanation in Markdown for the student learning term: "${term}".
${context ? `Context from flashcard / notes: "${context}"` : ''}

Include 1-2 curated educational references or study search links.

Respond with strict JSON:
{
  "explanation": "Clear markdown explanation...",
  "relatedLinks": [
    { "title": "Resource title", "url": "https://...", "snippet": "Description" }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/explain-term:', error);
    res.status(500).json({ error: error?.message || 'Failed to explain term' });
  }
});

// 7. Extract Text from PDF (Multimodal)
app.post('/api/ai/extract-pdf', async (req: Request, res: Response) => {
  try {
    const { pdfDataUri, apiKey } = req.body;
    if (!pdfDataUri || typeof pdfDataUri !== 'string') {
      return res.status(400).json({ error: 'pdfDataUri is required' });
    }

    const ai = getAI(apiKey);
    if (!ai) return res.status(400).json({ error: 'No Gemini API key available' });

    // Parse base64 data
    const matches = pdfDataUri.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid data URI format' });
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: 'Extract all textual content from this PDF document thoroughly. Output only the clean extracted text without conversational introductions.',
        },
      ],
    });

    res.json({ extractedText: response.text || '' });
  } catch (error: any) {
    console.error('Error in /api/ai/extract-pdf:', error);
    res.status(500).json({ error: error?.message || 'Failed to extract PDF' });
  }
});

// 8. AI Tutor Chat
app.post('/api/ai/chat-tutor', async (req: Request, res: Response) => {
  try {
    const { messages, context, apiKey } = req.body;
    const ai = getAI(apiKey);
    if (!ai) return res.status(400).json({ error: 'No Gemini API key available' });

    const systemPrompt = `You are Temari / StudySmart AI, an encouraging, brilliant personal tutor for students.
Your goal is to help students understand concepts deeply, solve problems step by step, and retain information through active recall.
${context ? `Current student study context:\n${context}` : ''}
Use clean markdown, bold terms, bullet points, and code/math formatting where helpful.`;

    const chatHistory = (messages || []).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const prompt = `${systemPrompt}\n\nConversation:\n${chatHistory}\n\nASSISTANT:`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    res.json({ reply: response.text || 'I am here to help you study!' });
  } catch (error: any) {
    console.error('Error in /api/ai/chat-tutor:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate tutor response' });
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
