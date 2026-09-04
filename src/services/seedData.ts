import {
  Subject,
  StoredNote,
  StoredQuiz,
  StoredAttempt,
  StudyTask,
  UserSettings,
} from '../types';

export const STORAGE_KEYS = {
  SUBJECTS: 'studySmartsSubjects',
  NOTES: 'studySmartsNotes',
  QUIZZES: 'studySmartsQuizzes',
  ATTEMPTS: 'studySmartsAttemptsHistory',
  TASKS: 'studySmartsTasks',
  SETTINGS: 'studySmartsSettings',
  PDF_CACHE: 'studySmartsPdfCache',
};

export const DEFAULT_SETTINGS: UserSettings = {
  selectedProvider: 'gemini',
  selectedModel: 'gemini-2.5-flash',
  providerKeys: {},
  customBaseUrl: 'http://localhost:11434/v1',
  customModelName: 'llama3.2:3b',
  theme: 'neobrutalist',
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  soundEnabled: true,
};

export const SEED_SUBJECTS: Subject[] = [
  {
    id: 'subj-cell-bio',
    name: 'Cellular Biology & Genetics',
    description: 'Structure of cells, cellular respiration, DNA replication, and Mendelian inheritance.',
    color: '#10B981',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: 'subj-comp-sci',
    name: 'Computer Systems & Networks',
    description: 'Operating systems, concurrency, TCP/IP protocols, distributed systems, and caching.',
    color: '#3B82F6',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 'subj-macro-econ',
    name: 'Macroeconomics & Fiscal Policy',
    description: 'GDP, monetary policy, inflation indices, aggregate supply/demand, and international trade.',
    color: '#F59E0B',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export const SEED_NOTES: StoredNote[] = [
  {
    id: 'note-respiration-1',
    subjectId: 'subj-cell-bio',
    title: 'Cellular Respiration & ATP Synthesis',
    sourceName: 'Chapter 9 - Campbell Biology.pdf',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    tags: ['Biochemistry', 'Metabolism', 'Mitochondria'],
    content: `# Cellular Respiration & ATP Synthesis
<span class="citation">[[1]]</span>

Cellular respiration is a set of metabolic reactions and processes that take place in the cells of organisms to convert biochemical energy from nutrients into adenosine triphosphate (ATP), releasing waste products.

## 1. Overview of Key Stages

> [!IMPORTANT]
> The complete oxidation of one glucose molecule ($C_6H_{12}O_6$) produces an estimated net yield of **30 to 32 ATP molecules**.

### Stage Comparison

| Stage | Location | Primary Input | Net Output per Glucose |
| :--- | :--- | :--- | :--- |
| **Glycolysis** | Cytosol | 1 Glucose, 2 NAD+, 2 ATP | 2 Pyruvate, 2 NADH, 2 ATP (net) |
| **Pyruvate Oxidation** | Mitochondrial Matrix | 2 Pyruvate, 2 CoA, 2 NAD+ | 2 Acetyl-CoA, 2 CO2, 2 NADH |
| **Citric Acid (Krebs) Cycle** | Mitochondrial Matrix | 2 Acetyl-CoA, 6 NAD+, 2 FAD | 4 CO2, 6 NADH, 2 FADH2, 2 ATP |
| **Oxidative Phosphorylation** | Inner Mitochondrial Membrane | 10 NADH, 2 FADH2, 6 O2 | ~26-28 ATP, 6 H2O |

## 2. Interactive Mindmap

\`\`\`mermaid
mindmap
  root((Cellular Respiration))
    Glycolysis
      Occurs in Cytosol
      Anaerobic Pathway
      Net 2 ATP + 2 NADH
    Pyruvate Oxidation
      Translocates into Matrix
      Forms Acetyl-CoA
      Releases Carbon Dioxide
    Citric Acid Cycle
      Oxaloacetate Regeneration
      High Yield of NADH and FADH2
    Oxidative Phosphorylation
      Electron Transport Chain
      Proton Gradient Formation
      ATP Synthase Chemiosmosis
\`\`\`

## 3. Critical Concepts for Exams

- **Chemiosmosis**: The movement of ions across a semipermeable membrane down their electrochemical gradient. Specifically, hydrogen ions ($H^+$) flow through ATP Synthase.
- **Oxygen's Role**: Molecular oxygen ($O_2$) serves as the final electron acceptor at Complex IV, combining with electrons and protons to yield $H_2O$.

> [!TIP]
> If oxygen is absent, cells enter anaerobic fermentation (lactic acid fermentation in animals or ethanol fermentation in yeast) to regenerate $NAD^+$ for glycolysis to continue.

## References
1. Campbell, N. A. (2020). *Biology* (12th ed.). Pearson. Chapter 9: Cellular Respiration.
`,
  },
];

export const SEED_QUIZZES: StoredQuiz[] = [
  {
    id: 'quiz-respiration-1',
    subjectId: 'subj-cell-bio',
    name: 'Cellular Respiration Rapid Flashcards',
    quizLengthUsed: 5,
    difficulty: 'Medium',
    timesPracticed: 3,
    lastScore: 80,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    flashcards: [
      {
        id: 'fc-1',
        question: 'Where does glycolysis take place in eukaryotic cells, and does it require oxygen?',
        answer: 'Glycolysis takes place in the cytosol (cytoplasm) of the cell. It is an anaerobic process, meaning it does NOT require oxygen.',
        difficulty: 'Easy',
        tags: ['Glycolysis', 'Cell Structure'],
      },
      {
        id: 'fc-2',
        question: 'What is the final electron acceptor in the electron transport chain during aerobic respiration?',
        answer: 'Molecular Oxygen (O2). It accepts electrons and combines with protons (H+) to form water (H2O).',
        difficulty: 'Medium',
        tags: ['Oxidative Phosphorylation', 'Biochemistry'],
      },
      {
        id: 'fc-3',
        question: 'What enzyme utilizes the proton-motive force across the inner mitochondrial membrane to generate ATP?',
        answer: 'ATP Synthase. Protons flow down their electrochemical gradient through the rotor subunit of ATP Synthase, driving the phosphorylation of ADP to ATP (Chemiosmosis).',
        difficulty: 'Medium',
        tags: ['Enzymes', 'Mitochondria'],
      },
      {
        id: 'fc-4',
        question: 'How many net ATP molecules are produced directly by substrate-level phosphorylation per glucose molecule in the Citric Acid Cycle?',
        answer: '2 ATP (or GTP, depending on tissue type), representing 1 ATP per turn of the cycle since 1 glucose yields 2 Acetyl-CoA molecules.',
        difficulty: 'Hard',
        tags: ['Krebs Cycle', 'Bioenergetics'],
      },
      {
        id: 'fc-5',
        question: 'What is the primary evolutionary purpose of fermentation in anaerobic conditions?',
        answer: 'To regenerate oxidized NAD+ from reduced NADH, allowing glycolysis to continue producing ATP via substrate-level phosphorylation without oxygen.',
        difficulty: 'Hard',
        tags: ['Fermentation', 'Metabolism'],
      },
    ],
  },
];

export const SEED_ATTEMPTS: StoredAttempt[] = [
  {
    id: 'att-1',
    subjectId: 'subj-cell-bio',
    subjectName: 'Cellular Biology & Genetics',
    name: 'Midterm Practice Mock Exam #1',
    type: 'Exam',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    overallScore: 86.6,
    totalQuestions: 15,
    correctQuestions: 13,
    timeSpentSeconds: 720,
    topicsToReview: ['Proton Motive Force', 'Mendelian Trihybrid Crosses'],
    extraReadings: [
      {
        title: 'Mitochondrial Bioenergetics and Chemiosmotic Coupling',
        url: 'https://www.nature.com/scitable/topicpage/mitochondria-14053590/',
        snippet: "Deep dive into Mitchell's chemiosmotic hypothesis and the membrane potentials that power ATP synthesis.",
      },
      {
        title: 'Khan Academy: Regulation of Cellular Respiration and Feedback Loops',
        url: 'https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation',
        snippet: 'Comprehensive tutorial on phosphofructokinase (PFK) allosteric control by ATP and AMP.',
      },
    ],
    examResults: [
      {
        question: 'Which of the following complexes in the ETC does NOT pump protons across the mitochondrial membrane?',
        type: 'multiple_choice',
        correctAnswer: 'Complex II (Succinate Dehydrogenase)',
        userAnswer: 'Complex II (Succinate Dehydrogenase)',
        isCorrect: true,
        topic: 'Electron Transport Chain',
        explanation: 'Complex II receives electrons from FADH2 and transfers them to ubiquinone without pumping protons.',
      },
      {
        question: 'In aerobic eukaryotes, pyruvate dehydrogenase complex is localized in the cytosol.',
        type: 'true_false',
        correctAnswer: 'false',
        userAnswer: 'true',
        isCorrect: false,
        topic: 'Pyruvate Oxidation',
        explanation: 'Pyruvate must first be transported across both mitochondrial membranes into the matrix where the pyruvate dehydrogenase complex resides.',
      },
    ],
  },
  {
    id: 'att-2',
    subjectId: 'subj-cell-bio',
    subjectName: 'Cellular Biology & Genetics',
    name: 'Cellular Respiration Flashcard Drill',
    type: 'Quiz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    overallScore: 100,
    totalQuestions: 5,
    correctQuestions: 5,
    timeSpentSeconds: 180,
    topicsToReview: [],
  },
  {
    id: 'att-3',
    subjectId: 'subj-comp-sci',
    subjectName: 'Computer Systems & Networks',
    name: 'Operating Systems & Concurrency Quiz',
    type: 'Quiz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    overallScore: 75,
    totalQuestions: 8,
    correctQuestions: 6,
    timeSpentSeconds: 240,
    topicsToReview: ['Deadlock Coffman Conditions', 'Virtual Memory TLB'],
  },
];

export const SEED_TASKS: StudyTask[] = [
  {
    id: 'task-1',
    subjectId: 'subj-cell-bio',
    title: 'Review Citric Acid Cycle & Oxidative Phosphorylation notes',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedMinutes: 30,
    completed: false,
  },
  {
    id: 'task-2',
    subjectId: 'subj-cell-bio',
    title: 'Practice 15-card Flashcard recall deck',
    dueDate: new Date().toISOString().split('T')[0],
    estimatedMinutes: 20,
    completed: true,
  },
  {
    id: 'task-3',
    subjectId: 'subj-comp-sci',
    title: 'Complete TCP 3-Way Handshake mock exam',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    estimatedMinutes: 45,
    completed: false,
  },
];
