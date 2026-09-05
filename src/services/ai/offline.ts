import { Flashcard, ExamQuestion, Article } from '../../types';
import {
  GenerationAdapter,
  GenerateExamParams,
  GenerateNotesParams,
  GenerateQuizParams,
  GradeExamParams,
  ExplainTermParams,
  GradeExamResult,
  ExplainTermResult,
} from './contracts';

/**
 * Offline adapter: placeholder study content assembled on the learner's device
 * when no Provider is reachable (CONTEXT.md: Offline generation). Behaviour is
 * moved verbatim from the former AIService client fallbacks — but it now sits
 * behind the port with a name, so the fallback policy is explicit.
 */

const sampleTopics = [
  'Homeostasis',
  'Cellular Respiration',
  'Enzyme Kinetics',
  'Signal Transduction',
  'Genetic Expression',
  'Thermodynamic Equilibrium',
];

export function createOfflineAdapter(): GenerationAdapter {
  return {
    async generateNotes(params: GenerateNotesParams): Promise<string> {
      const materialSnippet = params.material.slice(0, 1500);
      const title = params.sourceName?.replace(/\.[^/.]+$/, '') || 'Key Study Concepts';

      const sections = sampleTopics
        .map(
          (topic, idx) => `## ${idx + 1}. ${topic}
Core mechanisms governing **${topic}** are central to this material. Focus on:

- The primary inputs and outputs of the process.
- Key regulatory checkpoints and feedback loops.
- How ${topic.toLowerCase()} integrates with broader systemic functions.
`
        )
        .join('\n');

      return `# ${title}

> ⚠️ **Offline Draft**: These notes were generated locally without an AI Provider.
> Reconnect to a Provider and regenerate for full, structured study notes.

## Overview
This note distills the provided material into key conceptual clusters.

\`\`\`
${materialSnippet}
\`\`\`

${sections}

## Summary
Master the relationships between these topics; standardized exams frequently
test the boundaries and transitions between them.`;
    },

    async generateQuiz(params: GenerateQuizParams): Promise<Flashcard[]> {
      const cards: Flashcard[] = [];
      const count = Math.max(3, Math.min(params.quizLength, 15));
      const lines = params.material
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 40);

      for (let i = 0; i < count; i++) {
        const sourceLine = lines[i % Math.max(1, lines.length)] || sampleTopics[i % sampleTopics.length];
        const topic = sampleTopics[i % sampleTopics.length];
        cards.push({
          id: `fc-${Date.now()}-${i}`,
          question: `In the context of "${sourceLine.slice(0, 80)}...", what is the primary mechanism or defining feature of ${topic}?`,
          answer: `It governs the structural and functional relationship described in the material: ${sourceLine.slice(0, 120)}`,
          difficulty: i % 3 === 0 ? 'Easy' : i % 3 === 1 ? 'Medium' : 'Hard',
          tags: ['Offline Draft'],
        });
      }
      return cards;
    },

    async generateExam(params: GenerateExamParams): Promise<ExamQuestion[]> {
      const questions: ExamQuestion[] = [];
      const total = params.numberOfQuestions || 15;
      const lines = params.material
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 40);

      for (let i = 0; i < total; i++) {
        const sourceLine = lines[i % Math.max(1, lines.length)] || sampleTopics[i % sampleTopics.length];
        const currentTopic = sampleTopics[i % sampleTopics.length];
        const type: 'multiple_choice' | 'true_false' | 'short_answer' =
          i % 3 === 0 ? 'multiple_choice' : i % 3 === 1 ? 'true_false' : 'short_answer';

        if (type === 'multiple_choice') {
          questions.push({
            id: `q-${i + 1}`,
            type: 'multiple_choice',
            question: `Which process is most directly associated with "${sourceLine.slice(0, 80)}"?`,
            options: [currentTopic, 'Passive Diffusion', 'Osmotic Regulation', 'Thermal Conduction'],
            correctAnswer: currentTopic,
            explanation: `The material explicitly links this scenario to ${currentTopic}.`,
            topic: currentTopic,
          });
        } else if (type === 'true_false') {
          questions.push({
            id: `q-${i + 1}`,
            type: 'true_false',
            question: `True or False: "${sourceLine.slice(0, 100)}" is primarily regulated by passive thermal gradients rather than active biological loops and environmental conditions.`,
            correctAnswer: 'False',
            explanation: `Key points to include: energy transfer, regulatory checkpoints, and operational fidelity.`,
            topic: currentTopic,
          });
        } else {
          // Short Answer
          questions.push({
            id: `q-${i + 1}`,
            type: 'short_answer',
            question: `Briefly explain the functional outcome or evolutionary/systemic purpose of: "${sourceLine.slice(0, 90)}".`,
            correctAnswer: `It provides the critical catalytic or structural transition needed for downstream efficiency.`,
            explanation: `Key points to include: energy transfer, regulatory checkpoints, and operational fidelity.`,
            topic: currentTopic,
          });
        }
      }
      return questions;
    },

    async gradeExam(params: GradeExamParams): Promise<GradeExamResult> {
      const results = [];
      let correctCount = 0;
      const topicMistakes = new Set<string>();

      params.exam.forEach((q, idx) => {
        const userAns = (params.userAnswers[idx] || '').trim();
        let isCorrect = false;

        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          isCorrect = userAns.toLowerCase() === q.correctAnswer.toLowerCase();
        } else {
          // Short answer heuristic
          isCorrect = userAns.length > 10;
        }

        if (isCorrect) correctCount++;
        else topicMistakes.add(q.topic);

        results.push({
          question: q.question,
          type: q.type,
          correctAnswer: q.correctAnswer,
          userAnswer: userAns || '(Unanswered)',
          isCorrect,
          explanation: q.explanation || `The standard verified answer is: ${q.correctAnswer}`,
          topic: q.topic,
        });
      });

      const overallScore = Math.round((correctCount / Math.max(1, params.exam.length)) * 100);
      const topicsToReview = Array.from(topicMistakes);

      const extraReadings: Article[] = topicsToReview.map((topic) => ({
        title: `In-Depth Guide: ${topic} Fundamentals & Case Studies`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
        snippet: `Comprehensive conceptual overview and review material for ${topic}.`,
      }));

      if (extraReadings.length === 0) {
        extraReadings.push({
          title: 'Advanced Mastery & Synthesis Resources',
          url: 'https://ocw.mit.edu',
          snippet:
            'Explore university-level lecture notes and problem sets to take your knowledge to the next level.',
        });
      }

      return {
        results,
        overallScore,
        topicsToReview,
        extraReadings: extraReadings.slice(0, 4),
      };
    },

    async explainTerm(params: ExplainTermParams): Promise<ExplainTermResult> {
      return {
        explanation: `**${params.term}** refers to a fundamental concept in this subject. ${params.context ? `Within the context of *"${params.context.slice(0, 100)}..."*, it ` : 'It '}defines the key mechanism governing the behavior, properties, or relationships observed in this topic. Mastering this distinction prevents common misconceptions on standardized exams.`,
        relatedLinks: [
          {
            title: `Study Resource: ${params.term}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(params.term + ' student study guide explanation')}`,
            snippet: `Search peer-reviewed literature and educational references for ${params.term}.`,
          },
        ],
      };
    },
  };
}

