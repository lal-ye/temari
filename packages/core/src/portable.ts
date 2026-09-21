/**
 * Credential-free, versioned data interchange for the Android prototype.
 *
 * This module is intentionally pure TypeScript. It has no React, browser,
 * storage, filesystem, or Node dependencies. Browser downloads and native
 * persistence belong to the composing applications, not this contract.
 */

export const PORTABLE_FORMAT = 'temari-portable' as const;
export const PORTABLE_SCHEMA_VERSION = 1 as const;

export type PortableTheme = 'dark' | 'light' | 'neobrutalist' | 'system';
export type PortableDifficulty = 'Easy' | 'Medium' | 'Hard';
export type PortableQuizDifficulty = PortableDifficulty | 'Mixed';
export type PortableQuestionType = 'multiple_choice' | 'true_false' | 'short_answer';
export type PortableAttemptType = 'Exam' | 'Quiz';
export type PortableBloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';
export type PortableCognitiveMix = 'recall' | 'balanced' | 'simulation' | 'deep';
export type PortableTaskPriority = 'low' | 'medium' | 'high';

/** Deliberately conservative limits for a small offline transfer file. */
export const PORTABLE_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  maxSubjects: 1_000,
  maxNotes: 5_000,
  maxQuizzes: 5_000,
  maxAttempts: 10_000,
  maxTasks: 10_000,
  maxFlashcardsPerQuiz: 1_000,
  maxExamQuestionsPerAttempt: 500,
  maxExamResultsPerAttempt: 500,
  maxOptionsPerQuestion: 8,
  maxTopicsPerAttempt: 500,
  maxReadingsPerAttempt: 500,
  maxTagsPerRecord: 100,
  maxStringLength: 1_000_000,
  maxShortStringLength: 10_000,
} as const;

export interface PortableSubject {
  id: string;
  name: string;
  amharicName?: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PortableNote {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  sourceName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PortableFlashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: PortableDifficulty;
  tags?: string[];
}

export interface PortableQuiz {
  id: string;
  subjectId: string;
  name: string;
  flashcards: PortableFlashcard[];
  courseMaterialExtract?: string;
  quizLengthUsed: number;
  difficulty: PortableQuizDifficulty;
  createdAt: string;
  updatedAt: string;
  lastScore?: number;
  timesPracticed?: number;
}

export interface PortableExamQuestion {
  id?: string;
  question: string;
  type: PortableQuestionType;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  topic: string;
  bloomLevel?: PortableBloomLevel;
  knowledgeUnitId?: string;
  rubric?: string[];
  sourceNoteId?: string;
}

export interface PortableExamResult {
  question: string;
  type: PortableQuestionType;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  topic: string;
  bloomLevel?: PortableBloomLevel;
  knowledgeUnitId?: string;
  rubricEarned?: string[];
}

export interface PortableArticle {
  title: string;
  url: string;
  snippet?: string;
}

export interface PortableAttempt {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  type: PortableAttemptType;
  gradedOffline?: boolean;
  date: string;
  timeSpentSeconds?: number;
  examQuestions?: PortableExamQuestion[];
  examResults?: PortableExamResult[];
  overallScore: number;
  totalQuestions: number;
  correctQuestions: number;
  topicsToReview?: string[];
  extraReadings?: PortableArticle[];
  cognitiveMix?: PortableCognitiveMix;
  knowledgeUnitTargeted?: boolean;
}

export interface PortableTask {
  id: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  dueDate: string;
  priority?: PortableTaskPriority;
  estimatedMinutes?: number;
  completed: boolean;
  type?: string;
  createdAt?: string;
}

export interface PortableData {
  subjects: PortableSubject[];
  notes: PortableNote[];
  quizzes: PortableQuiz[];
  attempts: PortableAttempt[];
  tasks: PortableTask[];
}

export interface PortablePreferences {
  theme: PortableTheme;
}

export interface PortableExport {
  format: typeof PORTABLE_FORMAT;
  schemaVersion: typeof PORTABLE_SCHEMA_VERSION;
  exportedAt: string;
  data: PortableData;
  preferences: PortablePreferences;
}

/** Read-only input keeps the web store's live collections out of the package. */
export interface PortableExportInput {
  data: {
    subjects: ReadonlyArray<PortableSubject>;
    notes: ReadonlyArray<PortableNote>;
    quizzes: ReadonlyArray<PortableQuiz>;
    attempts: ReadonlyArray<PortableAttempt>;
    tasks: ReadonlyArray<PortableTask>;
  };
  preferences: PortablePreferences;
}

export interface PortableCounts {
  subjects: number;
  notes: number;
  quizzes: number;
  attempts: number;
  tasks: number;
  flashcards: number;
}

export interface PortableIssue {
  path: string;
  code:
    | 'invalid_json'
    | 'too_large'
    | 'wrong_type'
    | 'missing'
    | 'unknown_field'
    | 'unsupported_format'
    | 'unsupported_schema'
    | 'invalid_value'
    | 'invalid_reference'
    | 'duplicate_id'
    | 'limit_exceeded';
  message: string;
}

export type PortableValidationResult =
  | { ok: true; value: PortableExport; counts: PortableCounts }
  | { ok: false; errors: PortableIssue[] };

export interface PortableMigrationResult {
  value: PortableExport;
  warnings: string[];
}

export class PortableValidationError extends Error {
  readonly issues: PortableIssue[];

  constructor(issues: PortableIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'PortableValidationError';
    this.issues = issues;
  }
}

const DIFFICULTIES = new Set<PortableDifficulty>(['Easy', 'Medium', 'Hard']);
const QUIZ_DIFFICULTIES = new Set<PortableQuizDifficulty>(['Easy', 'Medium', 'Hard', 'Mixed']);
const QUESTION_TYPES = new Set<PortableQuestionType>(['multiple_choice', 'true_false', 'short_answer']);
const BLOOM_LEVELS = new Set<PortableBloomLevel>([
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
]);
const COGNITIVE_MIXES = new Set<PortableCognitiveMix>(['recall', 'balanced', 'simulation', 'deep']);
const TASK_PRIORITIES = new Set<PortableTaskPriority>(['low', 'medium', 'high']);
const THEMES = new Set<PortableTheme>(['dark', 'light', 'neobrutalist', 'system']);

const ENVELOPE_KEYS = new Set(['format', 'schemaVersion', 'exportedAt', 'data', 'preferences']);
const DATA_KEYS = new Set(['subjects', 'notes', 'quizzes', 'attempts', 'tasks']);
const PREFERENCES_KEYS = new Set(['theme']);
const SUBJECT_KEYS = new Set(['id', 'name', 'amharicName', 'code', 'description', 'color', 'icon', 'createdAt', 'updatedAt']);
const NOTE_KEYS = new Set(['id', 'subjectId', 'title', 'content', 'sourceName', 'tags', 'createdAt', 'updatedAt']);
const FLASHCARD_KEYS = new Set(['id', 'question', 'answer', 'difficulty', 'tags']);
const QUIZ_KEYS = new Set([
  'id',
  'subjectId',
  'name',
  'flashcards',
  'courseMaterialExtract',
  'quizLengthUsed',
  'difficulty',
  'createdAt',
  'updatedAt',
  'lastScore',
  'timesPracticed',
]);
const EXAM_QUESTION_KEYS = new Set([
  'id',
  'question',
  'type',
  'options',
  'correctAnswer',
  'explanation',
  'topic',
  'bloomLevel',
  'knowledgeUnitId',
  'rubric',
  'sourceNoteId',
]);
const EXAM_RESULT_KEYS = new Set([
  'question',
  'type',
  'correctAnswer',
  'userAnswer',
  'isCorrect',
  'explanation',
  'topic',
  'bloomLevel',
  'knowledgeUnitId',
  'rubricEarned',
]);
const ARTICLE_KEYS = new Set(['title', 'url', 'snippet']);
const ATTEMPT_KEYS = new Set([
  'id',
  'subjectId',
  'subjectName',
  'name',
  'type',
  'gradedOffline',
  'date',
  'timeSpentSeconds',
  'examQuestions',
  'examResults',
  'overallScore',
  'totalQuestions',
  'correctQuestions',
  'topicsToReview',
  'extraReadings',
  'cognitiveMix',
  'knowledgeUnitTargeted',
]);
const TASK_KEYS = new Set([
  'id',
  'subjectId',
  'subjectName',
  'title',
  'dueDate',
  'priority',
  'estimatedMinutes',
  'completed',
  'type',
  'createdAt',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
  errors: PortableIssue[],
  path: string,
  code: PortableIssue['code'],
  message: string
): void {
  errors.push({ path, code, message });
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: PortableIssue[]
): void {
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) addIssue(errors, `${path}.${key}`, 'unknown_field', 'field is not part of schema version 1');
  });
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  maxLength: number = PORTABLE_LIMITS.maxShortStringLength
): string | undefined {
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.length === 0) {
    addIssue(errors, `${path}.${key}`, typeof candidate === 'undefined' ? 'missing' : 'wrong_type', 'expected a non-empty string');
    return undefined;
  }
  if (candidate.length > maxLength) {
    addIssue(errors, `${path}.${key}`, 'limit_exceeded', `string exceeds ${maxLength} characters`);
  }
  return candidate;
}

function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  maxLength: number = PORTABLE_LIMITS.maxShortStringLength
): void {
  if (typeof value[key] === 'undefined') return;
  if (typeof value[key] !== 'string') {
    addIssue(errors, `${path}.${key}`, 'wrong_type', 'expected a string when present');
    return;
  }
  if ((value[key] as string).length > maxLength) {
    addIssue(errors, `${path}.${key}`, 'limit_exceeded', `string exceeds ${maxLength} characters`);
  }
}

function requiredBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[]
): boolean | undefined {
  if (typeof value[key] !== 'boolean') {
    addIssue(errors, `${path}.${key}`, typeof value[key] === 'undefined' ? 'missing' : 'wrong_type', 'expected a boolean');
    return undefined;
  }
  return value[key] as boolean;
}

function optionalBoolean(value: Record<string, unknown>, key: string, path: string, errors: PortableIssue[]): void {
  if (typeof value[key] === 'undefined') return;
  if (typeof value[key] !== 'boolean') addIssue(errors, `${path}.${key}`, 'wrong_type', 'expected a boolean when present');
}

function requiredFiniteNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  min?: number,
  max?: number
): number | undefined {
  const candidate = value[key];
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    addIssue(errors, `${path}.${key}`, typeof candidate === 'undefined' ? 'missing' : 'wrong_type', 'expected a finite number');
    return undefined;
  }
  if (typeof min === 'number' && candidate < min) addIssue(errors, `${path}.${key}`, 'invalid_value', `must be at least ${min}`);
  if (typeof max === 'number' && candidate > max) addIssue(errors, `${path}.${key}`, 'invalid_value', `must be at most ${max}`);
  return candidate;
}

function optionalFiniteNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  min?: number,
  max?: number
): void {
  if (typeof value[key] === 'undefined') return;
  requiredFiniteNumber(value, key, path, errors, min, max);
}

function requiredInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  min = 0,
  max?: number
): number | undefined {
  const candidate = requiredFiniteNumber(value, key, path, errors, min, max);
  if (typeof candidate === 'number' && !Number.isInteger(candidate)) {
    addIssue(errors, `${path}.${key}`, 'invalid_value', 'expected an integer');
  }
  return candidate;
}

function optionalInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  min = 0,
  max?: number
): void {
  if (typeof value[key] === 'undefined') return;
  requiredInteger(value, key, path, errors, min, max);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 80 &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    isIsoDate(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}

function requiredTimestamp(value: Record<string, unknown>, key: string, path: string, errors: PortableIssue[]): string | undefined {
  const candidate = value[key];
  if (!isTimestamp(candidate)) {
    addIssue(errors, `${path}.${key}`, typeof candidate === 'undefined' ? 'missing' : 'invalid_value', 'expected an ISO-8601 timestamp');
    return undefined;
  }
  return candidate;
}

function optionalTimestamp(value: Record<string, unknown>, key: string, path: string, errors: PortableIssue[]): void {
  if (typeof value[key] === 'undefined') return;
  if (!isTimestamp(value[key])) addIssue(errors, `${path}.${key}`, 'invalid_value', 'expected an ISO-8601 timestamp when present');
}

function isDateOrTimestamp(value: unknown): value is string {
  return isIsoDate(value) || isTimestamp(value);
}

function requiredDateOrTimestamp(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[]
): string | undefined {
  const candidate = value[key];
  if (!isDateOrTimestamp(candidate)) {
    addIssue(errors, `${path}.${key}`, typeof candidate === 'undefined' ? 'missing' : 'invalid_value', 'expected an ISO date or timestamp');
    return undefined;
  }
  return candidate;
}

function optionalDateOrTimestamp(value: Record<string, unknown>, key: string, path: string, errors: PortableIssue[]): void {
  if (typeof value[key] === 'undefined') return;
  if (!isDateOrTimestamp(value[key])) addIssue(errors, `${path}.${key}`, 'invalid_value', 'expected an ISO date or timestamp when present');
}

function validateStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  maxItems: number = PORTABLE_LIMITS.maxTagsPerRecord
): void {
  if (typeof value[key] === 'undefined') return;
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    addIssue(errors, `${path}.${key}`, 'wrong_type', 'expected an array of strings when present');
    return;
  }
  if (candidate.length > maxItems) addIssue(errors, `${path}.${key}`, 'limit_exceeded', `array exceeds ${maxItems} items`);
  candidate.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      addIssue(errors, `${path}.${key}[${index}]`, 'wrong_type', 'expected a non-empty string');
    } else if (item.length > PORTABLE_LIMITS.maxShortStringLength) {
      addIssue(errors, `${path}.${key}[${index}]`, 'limit_exceeded', 'string is too long');
    }
  });
}

function validateArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: PortableIssue[],
  maxItems: number
): unknown[] {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    addIssue(errors, `${path}.${key}`, typeof candidate === 'undefined' ? 'missing' : 'wrong_type', 'expected an array');
    return [];
  }
  if (candidate.length > maxItems) addIssue(errors, `${path}.${key}`, 'limit_exceeded', `array exceeds ${maxItems} items`);
  return candidate;
}

function validateSubject(value: unknown, path: string, errors: PortableIssue[]): value is PortableSubject {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, SUBJECT_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  requiredString(value, 'name', path, errors);
  optionalString(value, 'amharicName', path, errors);
  optionalString(value, 'code', path, errors);
  optionalString(value, 'description', path, errors, PORTABLE_LIMITS.maxStringLength);
  optionalString(value, 'color', path, errors);
  optionalString(value, 'icon', path, errors);
  requiredTimestamp(value, 'createdAt', path, errors);
  optionalTimestamp(value, 'updatedAt', path, errors);
  return true;
}

function validateNote(value: unknown, path: string, errors: PortableIssue[]): value is PortableNote {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, NOTE_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  requiredString(value, 'subjectId', path, errors);
  requiredString(value, 'title', path, errors);
  requiredString(value, 'content', path, errors, PORTABLE_LIMITS.maxStringLength);
  optionalString(value, 'sourceName', path, errors);
  validateStringArray(value, 'tags', path, errors);
  requiredTimestamp(value, 'createdAt', path, errors);
  requiredTimestamp(value, 'updatedAt', path, errors);
  return true;
}

function validateFlashcard(value: unknown, path: string, errors: PortableIssue[]): value is PortableFlashcard {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, FLASHCARD_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  requiredString(value, 'question', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredString(value, 'answer', path, errors, PORTABLE_LIMITS.maxStringLength);
  const difficulty = requiredString(value, 'difficulty', path, errors);
  if (difficulty && !DIFFICULTIES.has(difficulty as PortableDifficulty)) {
    addIssue(errors, `${path}.difficulty`, 'invalid_value', 'unsupported difficulty');
  }
  validateStringArray(value, 'tags', path, errors);
  return true;
}

function validateQuiz(value: unknown, path: string, errors: PortableIssue[]): value is PortableQuiz {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, QUIZ_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  requiredString(value, 'subjectId', path, errors);
  requiredString(value, 'name', path, errors);
  const flashcards = validateArray(value, 'flashcards', path, errors, PORTABLE_LIMITS.maxFlashcardsPerQuiz);
  flashcards.forEach((card, index) => validateFlashcard(card, `${path}.flashcards[${index}]`, errors));
  optionalString(value, 'courseMaterialExtract', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredInteger(value, 'quizLengthUsed', path, errors);
  const difficulty = requiredString(value, 'difficulty', path, errors);
  if (difficulty && !QUIZ_DIFFICULTIES.has(difficulty as PortableQuizDifficulty)) {
    addIssue(errors, `${path}.difficulty`, 'invalid_value', 'unsupported quiz difficulty');
  }
  requiredTimestamp(value, 'createdAt', path, errors);
  requiredTimestamp(value, 'updatedAt', path, errors);
  optionalFiniteNumber(value, 'lastScore', path, errors, 0, 100);
  optionalInteger(value, 'timesPracticed', path, errors);
  return true;
}

function validateOptions(value: Record<string, unknown>, path: string, errors: PortableIssue[]): void {
  if (typeof value.options === 'undefined') return;
  if (!Array.isArray(value.options)) {
    addIssue(errors, `${path}.options`, 'wrong_type', 'expected an array of strings when present');
    return;
  }
  if (value.options.length > PORTABLE_LIMITS.maxOptionsPerQuestion) {
    addIssue(
      errors,
      `${path}.options`,
      'limit_exceeded',
      `array exceeds ${PORTABLE_LIMITS.maxOptionsPerQuestion} items`
    );
  }
  value.options.forEach((option, index) => {
    if (typeof option !== 'string' || option.length === 0) {
      addIssue(errors, `${path}.options[${index}]`, 'wrong_type', 'expected a non-empty string');
    } else if (option.length > PORTABLE_LIMITS.maxStringLength) {
      addIssue(
        errors,
        `${path}.options[${index}]`,
        'limit_exceeded',
        `string exceeds ${PORTABLE_LIMITS.maxStringLength} characters`
      );
    }
  });
}

function validateExamQuestion(value: unknown, path: string, errors: PortableIssue[]): value is PortableExamQuestion {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, EXAM_QUESTION_KEYS, path, errors);
  optionalString(value, 'id', path, errors);
  requiredString(value, 'question', path, errors, PORTABLE_LIMITS.maxStringLength);
  const type = requiredString(value, 'type', path, errors);
  if (type && !QUESTION_TYPES.has(type as PortableQuestionType)) {
    addIssue(errors, `${path}.type`, 'invalid_value', 'unsupported question type');
  }
  validateOptions(value, path, errors);
  requiredString(value, 'correctAnswer', path, errors, PORTABLE_LIMITS.maxStringLength);
  optionalString(value, 'explanation', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredString(value, 'topic', path, errors);
  optionalString(value, 'bloomLevel', path, errors);
  if (typeof value.bloomLevel === 'string' && !BLOOM_LEVELS.has(value.bloomLevel as PortableBloomLevel)) {
    addIssue(errors, `${path}.bloomLevel`, 'invalid_value', 'unsupported cognitive level');
  }
  optionalString(value, 'knowledgeUnitId', path, errors);
  validateStringArray(value, 'rubric', path, errors, 8);
  optionalString(value, 'sourceNoteId', path, errors);
  return true;
}

function validateExamResult(value: unknown, path: string, errors: PortableIssue[]): value is PortableExamResult {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, EXAM_RESULT_KEYS, path, errors);
  requiredString(value, 'question', path, errors, PORTABLE_LIMITS.maxStringLength);
  const type = requiredString(value, 'type', path, errors);
  if (type && !QUESTION_TYPES.has(type as PortableQuestionType)) {
    addIssue(errors, `${path}.type`, 'invalid_value', 'unsupported question type');
  }
  requiredString(value, 'correctAnswer', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredString(value, 'userAnswer', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredBoolean(value, 'isCorrect', path, errors);
  optionalString(value, 'explanation', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredString(value, 'topic', path, errors);
  optionalString(value, 'bloomLevel', path, errors);
  if (typeof value.bloomLevel === 'string' && !BLOOM_LEVELS.has(value.bloomLevel as PortableBloomLevel)) {
    addIssue(errors, `${path}.bloomLevel`, 'invalid_value', 'unsupported cognitive level');
  }
  optionalString(value, 'knowledgeUnitId', path, errors);
  validateStringArray(value, 'rubricEarned', path, errors, 8);
  return true;
}

function validateArticle(value: unknown, path: string, errors: PortableIssue[]): value is PortableArticle {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, ARTICLE_KEYS, path, errors);
  requiredString(value, 'title', path, errors);
  requiredString(value, 'url', path, errors, PORTABLE_LIMITS.maxShortStringLength);
  optionalString(value, 'snippet', path, errors, PORTABLE_LIMITS.maxStringLength);
  return true;
}

function validateAttempt(value: unknown, path: string, errors: PortableIssue[]): value is PortableAttempt {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, ATTEMPT_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  requiredString(value, 'subjectId', path, errors);
  requiredString(value, 'subjectName', path, errors);
  requiredString(value, 'name', path, errors);
  const type = requiredString(value, 'type', path, errors);
  if (type && type !== 'Exam' && type !== 'Quiz') addIssue(errors, `${path}.type`, 'invalid_value', 'unsupported attempt type');
  optionalBoolean(value, 'gradedOffline', path, errors);
  requiredDateOrTimestamp(value, 'date', path, errors);
  optionalFiniteNumber(value, 'timeSpentSeconds', path, errors, 0);
  if (typeof value.examQuestions !== 'undefined') {
    const questions = validateArray(value, 'examQuestions', path, errors, PORTABLE_LIMITS.maxExamQuestionsPerAttempt);
    questions.forEach((question, index) => validateExamQuestion(question, `${path}.examQuestions[${index}]`, errors));
  }
  if (typeof value.examResults !== 'undefined') {
    const results = validateArray(value, 'examResults', path, errors, PORTABLE_LIMITS.maxExamResultsPerAttempt);
    results.forEach((result, index) => validateExamResult(result, `${path}.examResults[${index}]`, errors));
  }
  const overallScore = requiredFiniteNumber(value, 'overallScore', path, errors, 0, 100);
  const totalQuestions = requiredInteger(value, 'totalQuestions', path, errors);
  const correctQuestions = requiredInteger(value, 'correctQuestions', path, errors);
  if (typeof totalQuestions === 'number' && typeof correctQuestions === 'number' && correctQuestions > totalQuestions) {
    addIssue(errors, `${path}.correctQuestions`, 'invalid_value', 'cannot exceed totalQuestions');
  }
  if (typeof overallScore === 'number' && typeof totalQuestions === 'number' && totalQuestions === 0 && overallScore !== 0) {
    addIssue(errors, `${path}.overallScore`, 'invalid_value', 'empty attempts must have a score of 0');
  }
  validateStringArray(value, 'topicsToReview', path, errors, PORTABLE_LIMITS.maxTopicsPerAttempt);
  if (typeof value.extraReadings !== 'undefined') {
    const readings = validateArray(value, 'extraReadings', path, errors, PORTABLE_LIMITS.maxReadingsPerAttempt);
    readings.forEach((reading, index) => validateArticle(reading, `${path}.extraReadings[${index}]`, errors));
  }
  optionalString(value, 'cognitiveMix', path, errors);
  if (typeof value.cognitiveMix === 'string' && !COGNITIVE_MIXES.has(value.cognitiveMix as PortableCognitiveMix)) {
    addIssue(errors, `${path}.cognitiveMix`, 'invalid_value', 'unsupported cognitive mix');
  }
  optionalBoolean(value, 'knowledgeUnitTargeted', path, errors);
  return true;
}

function validateTask(value: unknown, path: string, errors: PortableIssue[]): value is PortableTask {
  if (!isRecord(value)) {
    addIssue(errors, path, 'wrong_type', 'expected an object');
    return false;
  }
  checkKeys(value, TASK_KEYS, path, errors);
  requiredString(value, 'id', path, errors);
  optionalString(value, 'subjectId', path, errors);
  optionalString(value, 'subjectName', path, errors);
  requiredString(value, 'title', path, errors, PORTABLE_LIMITS.maxStringLength);
  requiredDateOrTimestamp(value, 'dueDate', path, errors);
  optionalString(value, 'priority', path, errors);
  if (typeof value.priority === 'string' && !TASK_PRIORITIES.has(value.priority as PortableTaskPriority)) {
    addIssue(errors, `${path}.priority`, 'invalid_value', 'unsupported task priority');
  }
  optionalFiniteNumber(value, 'estimatedMinutes', path, errors, 0);
  requiredBoolean(value, 'completed', path, errors);
  optionalString(value, 'type', path, errors);
  optionalDateOrTimestamp(value, 'createdAt', path, errors);
  return true;
}

function countPortableData(data: PortableData): PortableCounts {
  return {
    subjects: data.subjects.length,
    notes: data.notes.length,
    quizzes: data.quizzes.length,
    attempts: data.attempts.length,
    tasks: data.tasks.length,
    flashcards: data.quizzes.reduce((total, quiz) => total + quiz.flashcards.length, 0),
  };
}

function validateReferences(data: PortableData, errors: PortableIssue[]): void {
  const subjectIds = new Set(data.subjects.map((subject) => subject.id));
  data.notes.forEach((note, index) => {
    if (!subjectIds.has(note.subjectId)) addIssue(errors, `$.data.notes[${index}].subjectId`, 'invalid_reference', 'does not reference an exported Subject');
  });
  data.quizzes.forEach((quiz, index) => {
    if (!subjectIds.has(quiz.subjectId)) addIssue(errors, `$.data.quizzes[${index}].subjectId`, 'invalid_reference', 'does not reference an exported Subject');
  });
  data.attempts.forEach((attempt, index) => {
    if (!subjectIds.has(attempt.subjectId)) addIssue(errors, `$.data.attempts[${index}].subjectId`, 'invalid_reference', 'does not reference an exported Subject');
  });
  data.tasks.forEach((task, index) => {
    if (task.subjectId && !subjectIds.has(task.subjectId)) addIssue(errors, `$.data.tasks[${index}].subjectId`, 'invalid_reference', 'does not reference an exported Subject');
  });
}

function validateUniqueIds(data: PortableData, errors: PortableIssue[]): void {
  const seen = new Map<string, string>();
  const register = (id: string | undefined, path: string): void => {
    if (!id) return;
    const previous = seen.get(id);
    if (previous) {
      addIssue(errors, path, 'duplicate_id', `duplicates the record at ${previous}`);
      return;
    }
    seen.set(id, path);
  };

  data.subjects.forEach((item, index) => register(item.id, `$.data.subjects[${index}].id`));
  data.notes.forEach((item, index) => register(item.id, `$.data.notes[${index}].id`));
  data.quizzes.forEach((item, index) => {
    register(item.id, `$.data.quizzes[${index}].id`);
    item.flashcards.forEach((card, cardIndex) => register(card.id, `$.data.quizzes[${index}].flashcards[${cardIndex}].id`));
  });
  data.attempts.forEach((item, index) => {
    register(item.id, `$.data.attempts[${index}].id`);
    item.examQuestions?.forEach((question, questionIndex) => register(question.id, `$.data.attempts[${index}].examQuestions[${questionIndex}].id`));
  });
  data.tasks.forEach((item, index) => register(item.id, `$.data.tasks[${index}].id`));
}

export function validatePortableExport(input: unknown): PortableValidationResult {
  const errors: PortableIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', code: 'wrong_type', message: 'expected a portable export object' }] };
  }

  try {
    const serialized = JSON.stringify(input);
    if (typeof serialized === 'string' && utf8ByteLength(serialized) > PORTABLE_LIMITS.maxBytes) {
      errors.push({
        path: '$',
        code: 'too_large',
        message: `serialized export exceeds ${PORTABLE_LIMITS.maxBytes} bytes`,
      });
    }
  } catch {
    errors.push({ path: '$', code: 'invalid_value', message: 'export contains values that cannot be serialized as JSON' });
  }

  checkKeys(input, ENVELOPE_KEYS, '$', errors);
  if (input.format !== PORTABLE_FORMAT) addIssue(errors, '$.format', 'unsupported_format', `expected ${PORTABLE_FORMAT}`);
  if (input.schemaVersion !== PORTABLE_SCHEMA_VERSION) {
    addIssue(
      errors,
      '$.schemaVersion',
      'unsupported_schema',
      `only schema version ${PORTABLE_SCHEMA_VERSION} is supported`
    );
  }
  requiredTimestamp(input, 'exportedAt', '$', errors);

  if (!isRecord(input.data)) {
    addIssue(errors, '$.data', typeof input.data === 'undefined' ? 'missing' : 'wrong_type', 'expected an object');
    return { ok: false, errors };
  }
  checkKeys(input.data, DATA_KEYS, '$.data', errors);
  const subjects = validateArray(input.data, 'subjects', '$.data', errors, PORTABLE_LIMITS.maxSubjects);
  const notes = validateArray(input.data, 'notes', '$.data', errors, PORTABLE_LIMITS.maxNotes);
  const quizzes = validateArray(input.data, 'quizzes', '$.data', errors, PORTABLE_LIMITS.maxQuizzes);
  const attempts = validateArray(input.data, 'attempts', '$.data', errors, PORTABLE_LIMITS.maxAttempts);
  const tasks = validateArray(input.data, 'tasks', '$.data', errors, PORTABLE_LIMITS.maxTasks);

  subjects.forEach((item, index) => validateSubject(item, `$.data.subjects[${index}]`, errors));
  notes.forEach((item, index) => validateNote(item, `$.data.notes[${index}]`, errors));
  quizzes.forEach((item, index) => validateQuiz(item, `$.data.quizzes[${index}]`, errors));
  attempts.forEach((item, index) => validateAttempt(item, `$.data.attempts[${index}]`, errors));
  tasks.forEach((item, index) => validateTask(item, `$.data.tasks[${index}]`, errors));

  if (!isRecord(input.preferences)) {
    addIssue(errors, '$.preferences', typeof input.preferences === 'undefined' ? 'missing' : 'wrong_type', 'expected an object');
  } else {
    checkKeys(input.preferences, PREFERENCES_KEYS, '$.preferences', errors);
    const theme = requiredString(input.preferences, 'theme', '$.preferences', errors);
    if (theme && !THEMES.has(theme as PortableTheme)) addIssue(errors, '$.preferences.theme', 'invalid_value', 'unsupported theme');
  }

  if (errors.length > 0) return { ok: false, errors };

  const data = {
    subjects: subjects as PortableSubject[],
    notes: notes as PortableNote[],
    quizzes: quizzes as PortableQuiz[],
    attempts: attempts as PortableAttempt[],
    tasks: tasks as PortableTask[],
  } satisfies PortableData;

  validateUniqueIds(data, errors);
  validateReferences(data, errors);
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: input as unknown as PortableExport,
    counts: countPortableData(data),
  };
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function copySubject(input: PortableSubject): PortableSubject {
  return {
    id: input.id,
    name: input.name,
    ...(input.amharicName !== undefined ? { amharicName: input.amharicName } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    createdAt: input.createdAt,
    ...(input.updatedAt !== undefined ? { updatedAt: input.updatedAt } : {}),
  };
}

function copyNote(input: PortableNote): PortableNote {
  return {
    id: input.id,
    subjectId: input.subjectId,
    title: input.title,
    content: input.content,
    ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
    ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function copyFlashcard(input: PortableFlashcard): PortableFlashcard {
  return {
    id: input.id,
    question: input.question,
    answer: input.answer,
    difficulty: input.difficulty,
    ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
  };
}

function copyQuiz(input: PortableQuiz): PortableQuiz {
  return {
    id: input.id,
    subjectId: input.subjectId,
    name: input.name,
    flashcards: input.flashcards.map(copyFlashcard),
    ...(input.courseMaterialExtract !== undefined ? { courseMaterialExtract: input.courseMaterialExtract } : {}),
    quizLengthUsed: input.quizLengthUsed,
    difficulty: input.difficulty,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    ...(input.lastScore !== undefined ? { lastScore: input.lastScore } : {}),
    ...(input.timesPracticed !== undefined ? { timesPracticed: input.timesPracticed } : {}),
  };
}

function copyExamQuestion(input: PortableExamQuestion): PortableExamQuestion {
  return {
    ...(input.id !== undefined ? { id: input.id } : {}),
    question: input.question,
    type: input.type,
    ...(input.options !== undefined ? { options: [...input.options] } : {}),
    correctAnswer: input.correctAnswer,
    ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
    topic: input.topic,
    ...(input.bloomLevel !== undefined ? { bloomLevel: input.bloomLevel } : {}),
    ...(input.knowledgeUnitId !== undefined ? { knowledgeUnitId: input.knowledgeUnitId } : {}),
    ...(input.rubric !== undefined ? { rubric: [...input.rubric] } : {}),
    ...(input.sourceNoteId !== undefined ? { sourceNoteId: input.sourceNoteId } : {}),
  };
}

function copyExamResult(input: PortableExamResult): PortableExamResult {
  return {
    question: input.question,
    type: input.type,
    correctAnswer: input.correctAnswer,
    userAnswer: input.userAnswer,
    isCorrect: input.isCorrect,
    ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
    topic: input.topic,
    ...(input.bloomLevel !== undefined ? { bloomLevel: input.bloomLevel } : {}),
    ...(input.knowledgeUnitId !== undefined ? { knowledgeUnitId: input.knowledgeUnitId } : {}),
    ...(input.rubricEarned !== undefined ? { rubricEarned: [...input.rubricEarned] } : {}),
  };
}

function copyArticle(input: PortableArticle): PortableArticle {
  return {
    title: input.title,
    url: input.url,
    ...(input.snippet !== undefined ? { snippet: input.snippet } : {}),
  };
}

function copyAttempt(input: PortableAttempt): PortableAttempt {
  return {
    id: input.id,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    name: input.name,
    type: input.type,
    ...(input.gradedOffline !== undefined ? { gradedOffline: input.gradedOffline } : {}),
    date: input.date,
    ...(input.timeSpentSeconds !== undefined ? { timeSpentSeconds: input.timeSpentSeconds } : {}),
    ...(input.examQuestions !== undefined ? { examQuestions: input.examQuestions.map(copyExamQuestion) } : {}),
    ...(input.examResults !== undefined ? { examResults: input.examResults.map(copyExamResult) } : {}),
    overallScore: input.overallScore,
    totalQuestions: input.totalQuestions,
    correctQuestions: input.correctQuestions,
    ...(input.topicsToReview !== undefined ? { topicsToReview: [...input.topicsToReview] } : {}),
    ...(input.extraReadings !== undefined ? { extraReadings: input.extraReadings.map(copyArticle) } : {}),
    ...(input.cognitiveMix !== undefined ? { cognitiveMix: input.cognitiveMix } : {}),
    ...(input.knowledgeUnitTargeted !== undefined ? { knowledgeUnitTargeted: input.knowledgeUnitTargeted } : {}),
  };
}

function copyTask(input: PortableTask): PortableTask {
  return {
    id: input.id,
    ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
    ...(input.subjectName !== undefined ? { subjectName: input.subjectName } : {}),
    title: input.title,
    dueDate: input.dueDate,
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
    completed: input.completed,
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
  };
}

function copyData(input: PortableExportInput['data']): PortableData {
  return {
    subjects: input.subjects.map(copySubject),
    notes: input.notes.map(copyNote),
    quizzes: input.quizzes.map(copyQuiz),
    attempts: input.attempts.map(copyAttempt),
    tasks: input.tasks.map(copyTask),
  };
}

function assertValid(value: unknown): PortableExport {
  const result = validatePortableExport(value);
  if (result.ok === false) throw new PortableValidationError(result.errors);
  return result.value;
}

export function createPortableExport(input: PortableExportInput, exportedAt = new Date().toISOString()): PortableExport {
  const candidate: PortableExport = {
    format: PORTABLE_FORMAT,
    schemaVersion: PORTABLE_SCHEMA_VERSION,
    exportedAt,
    data: copyData(input.data),
    preferences: { theme: input.preferences.theme },
  };
  return assertValid(candidate);
}

export function serializePortableExport(input: PortableExportInput, exportedAt = new Date().toISOString()): string {
  const value = createPortableExport(input, exportedAt);
  const json = JSON.stringify(value, null, 2);
  if (utf8ByteLength(json) > PORTABLE_LIMITS.maxBytes) {
    throw new PortableValidationError([
      {
        path: '$',
        code: 'too_large',
        message: `serialized export exceeds ${PORTABLE_LIMITS.maxBytes} bytes`,
      },
    ]);
  }
  return json;
}

export function parsePortableExport(input: string | unknown): PortableValidationResult {
  if (typeof input === 'string') {
    if (utf8ByteLength(input) > PORTABLE_LIMITS.maxBytes) {
      return {
        ok: false,
        errors: [
          {
            path: '$',
            code: 'too_large',
            message: `input exceeds ${PORTABLE_LIMITS.maxBytes} bytes`,
          },
        ],
      };
    }
    try {
      return validatePortableExport(JSON.parse(input) as unknown);
    } catch {
      return { ok: false, errors: [{ path: '$', code: 'invalid_json', message: 'input is not valid JSON' }] };
    }
  }
  return validatePortableExport(input);
}

/**
 * Convert the existing generic v1 browser backup into the portable envelope.
 * The legacy settings object is intentionally treated as untrusted and only
 * its allowlisted theme is read. No legacy credential field is copied.
 */
export function migrateLegacyBackup(input: unknown, exportedAt = new Date().toISOString()): PortableMigrationResult {
  const errors: PortableIssue[] = [];
  if (!isRecord(input)) {
    throw new PortableValidationError([{ path: '$', code: 'wrong_type', message: 'expected a legacy backup object' }]);
  }
  if (input.version !== 1) {
    addIssue(errors, '$.version', 'unsupported_schema', 'only legacy backup version 1 can be migrated');
  }

  const collectionKeys = ['subjects', 'notes', 'quizzes', 'attempts', 'tasks'] as const;
  collectionKeys.forEach((key) => {
    if (!Array.isArray(input[key])) addIssue(errors, `$.${key}`, 'wrong_type', 'expected an array in the legacy backup');
  });
  if (errors.length > 0) throw new PortableValidationError(errors);

  const settings = isRecord(input.settings) ? input.settings : {};
  const theme = THEMES.has(settings.theme as PortableTheme) ? (settings.theme as PortableTheme) : 'system';
  const timestamp = isTimestamp(input.timestamp) ? input.timestamp : exportedAt;

  const candidate = {
    format: PORTABLE_FORMAT,
    schemaVersion: PORTABLE_SCHEMA_VERSION,
    exportedAt: timestamp,
    data: {
      subjects: input.subjects,
      notes: input.notes,
      quizzes: input.quizzes,
      attempts: input.attempts,
      tasks: input.tasks,
    },
    preferences: { theme },
  };
  const validation = validatePortableExport(candidate);
  if (validation.ok === false) throw new PortableValidationError(validation.errors);

  const value = createPortableExport(
    {
      data: validation.value.data,
      preferences: validation.value.preferences,
    },
    timestamp
  );

  return {
    value,
    warnings: ['Legacy backup migrated; credential-bearing and transient settings were discarded.'],
  };
}

/** Kept exported for consumers that want to report preview counts without reimplementing aggregation. */
export function portableCounts(value: PortableExport): PortableCounts {
  return countPortableData(value.data);
}
