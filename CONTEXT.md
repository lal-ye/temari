# Temari (ተማሪ)

An AI study companion. A learner organises study content under Subjects, generates
Notes, Quizzes and Exams from raw Material, practises them, and reviews graded
Attempts in Analytics and the Planner.

## Language

### Study content

**Subject**:
A course or study area. Every Note, Quiz, Exam Attempt and Study Task belongs to exactly one Subject.
_Avoid_: course, class, folder

**Active Subject**:
The single Subject the app is currently scoped to; screens show only the Active Subject's materials.

**Material**:
Raw study text — pasted, or extracted from an uploaded PDF — from which Notes, Quizzes and Exams are generated.
_Avoid_: source, content, document

**Note**:
A markdown study document (may include mindmaps and callouts) generated from Material or written for a Subject.
_Avoid_: doc, article

**Flashcard**:
A question–answer pair with a difficulty rating, used for active recall.
_Avoid_: card

**Quiz**:
A named deck of Flashcards belonging to one Subject.
_Avoid_: deck, flashcard set, drill set

**Drill**:
One practice session over a Quiz.
_Avoid_: run, session

**Exam**:
An AI-generated assessment (multiple choice, true/false, short answer) taken in one sitting.
_Avoid_: mock, test

**Attempt**:
The graded record of a completed Drill or Exam. The only unit Analytics and the Planner consume.
_Avoid_: result, score, history entry

**Study Task**:
A planner item with a due date, optionally scoped to a Subject.
_Avoid_: todo, reminder

### AI generation

**Generation**:
Producing Notes, Quiz Flashcards, Exam questions, Exam grading, or term explanations from Material via a Provider.
_Avoid_: synthesis, completion

**Provider**:
An AI vendor or endpoint (Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter, Custom/Ollama) able to generate.
_Avoid_: vendor, backend, engine

**Model**:
A specific model offered by a Provider, selected by the learner.

**BYOK**:
Bring Your Own Key — a learner-supplied Provider API key stored in their settings, taking precedence over server keys.
_Avoid_: personal key, user key

**Offline generation**:
Placeholder study content produced on the learner's device when no Provider is reachable. It must always be identifiable as offline content, never presented as Provider output.
_Avoid_: fallback, demo mode, fake AI
