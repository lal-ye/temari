import { Flashcard, ExamQuestion, Article, KnowledgeUnit } from '../../types';
import {
  GenerationAdapter,
  ExtractKnowledgeUnitsParams,
  GenerateExamParams,
  GenerateNotesParams,
  GenerateQuizParams,
  GradeExamParams,
  ExplainTermParams,
  GradeExamResult,
  ExplainTermResult,
} from './contracts';

/**
 * Offline knowledge-unit extraction: Markdown headings first, then the longest
 * sentences as a fallback. Purely structural — it finds *where* the material
 * makes claims, it cannot judge which claims matter. That limit is why every
 * offline exam question is labelled Remember (see generateExam below).
 */
export function extractKnowledgeUnitsFromText(
  material: string,
  maxUnits = 12
): KnowledgeUnit[] {
  const cap = Math.max(1, Math.min(maxUnits, 20));
  const units: KnowledgeUnit[] = [];
  const lines = material.split(/\r?\n/);

  // Headings are the author's own statement of what a section is about.
  lines.forEach((line, idx) => {
    if (units.length >= cap) return;
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) return;
    const concept = heading[1].replace(/[*_`]/g, '').trim();
    if (concept.length < 3) return;

    // Take the first substantive line after the heading as its definition.
    const body = lines
      .slice(idx + 1)
      .find((l) => l.trim().length > 30 && !/^\s{0,3}#{1,6}\s/.test(l));

    units.push({
      id: `ku-${units.length + 1}`,
      concept,
      definition: (body ?? concept).trim().slice(0, 280),
      sourceSnippet: body?.trim().slice(0, 280),
    });
  });

  // No headings at all (pasted plain text): fall back to declarative sentences.
  if (units.length === 0) {
    material
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40 && s.length < 320)
      .slice(0, cap)
      .forEach((sentence, idx) => {
        const words = sentence.split(/\s+/);
        units.push({
          id: `ku-${idx + 1}`,
          concept: words.slice(0, 6).join(' ').replace(/[,;:]+$/, ''),
          definition: sentence,
          sourceSnippet: sentence,
        });
      });
  }

  return units;
}

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

    async extractKnowledgeUnits(params: ExtractKnowledgeUnitsParams): Promise<KnowledgeUnit[]> {
      return extractKnowledgeUnitsFromText(params.material, params.maxUnits);
    },

    /**
     * Offline exams are recall-only, and say so.
     *
     * Every item is tagged `bloomLevel: 'remember'` regardless of the requested
     * plan: sentence extraction can produce "what does the material say", never
     * "justify this design". Claiming a higher level would make the mastery
     * dashboard lie about what was practised, which is worse than admitting the
     * draft is shallow (CONTEXT.md: Offline generation).
     */
    async generateExam(params: GenerateExamParams): Promise<ExamQuestion[]> {
      const questions: ExamQuestion[] = [];
      const planTotal = params.bloomPlan?.reduce((sum, slot) => sum + slot.count, 0) ?? 0;
      const total = planTotal || params.numberOfQuestions || 15;
      const units = extractKnowledgeUnitsFromText(params.material, Math.max(6, total));
      const lines = params.material
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 40);

      for (let i = 0; i < total; i++) {
        const sourceLine = lines[i % Math.max(1, lines.length)] || sampleTopics[i % sampleTopics.length];
        // Prefer the extracted unit over the rotating sample topic, so the
        // offline draft at least names real ideas from the learner's material.
        const unit = units[i % Math.max(1, units.length)];
        const currentTopic = unit?.concept || sampleTopics[i % sampleTopics.length];
        const type: 'multiple_choice' | 'true_false' | 'short_answer' =
          i % 3 === 0 ? 'multiple_choice' : i % 3 === 1 ? 'true_false' : 'short_answer';

        const shared = {
          bloomLevel: 'remember' as const,
          knowledgeUnitId: unit?.id,
        };

        if (type === 'multiple_choice') {
          questions.push({
            id: `q-${i + 1}`,
            type: 'multiple_choice',
            question: `Which process is most directly associated with "${sourceLine.slice(0, 80)}"?`,
            options: [currentTopic, 'Passive Diffusion', 'Osmotic Regulation', 'Thermal Conduction'],
            correctAnswer: currentTopic,
            explanation: `The material explicitly links this scenario to ${currentTopic}.`,
            topic: currentTopic,
            ...shared,
          });
        } else if (type === 'true_false') {
          questions.push({
            id: `q-${i + 1}`,
            type: 'true_false',
            question: `True or False: "${sourceLine.slice(0, 100)}" is primarily regulated by passive thermal gradients rather than active biological loops and environmental conditions.`,
            correctAnswer: 'False',
            explanation: `Key points to include: energy transfer, regulatory checkpoints, and operational fidelity.`,
            topic: currentTopic,
            ...shared,
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
            rubric: [
              'Names the process or structure involved.',
              'States its functional outcome.',
              'Links it to the surrounding system.',
            ],
            ...shared,
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
        let rubricEarned: string[] | undefined;

        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          isCorrect = userAns.toLowerCase() === q.correctAnswer.toLowerCase();
        } else if (q.rubric && q.rubric.length > 0) {
          // Rubric-scored heuristic: a rubric point counts as earned when the
          // answer shares a distinctive word with it (words of 5+ letters, so
          // "the" and "and" cannot carry a point). Pass = half the rubric.
          const answerWords = new Set(
            userAns
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length >= 5)
          );
          rubricEarned = q.rubric.filter((point) =>
            point
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .some((w) => w.length >= 5 && answerWords.has(w))
          );
          isCorrect = rubricEarned.length >= Math.ceil(q.rubric.length / 2);
        } else {
          // No rubric: fall back to the old "they wrote something" heuristic.
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
          // Carried through so mastery is measurable per topic × level even
          // when a Provider was never reachable.
          bloomLevel: q.bloomLevel,
          knowledgeUnitId: q.knowledgeUnitId,
          rubricEarned,
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

