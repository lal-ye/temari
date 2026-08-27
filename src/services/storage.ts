import { Subject, StoredNote, StoredQuiz, StoredAttempt, StudyTask, UserSettings } from '../types';

const STORAGE_KEYS = {
  SUBJECTS: 'studySmartsSubjects',
  NOTES: 'studySmartsNotes',
  QUIZZES: 'studySmartsQuizzes',
  ATTEMPTS: 'studySmartsAttemptsHistory',
  TASKS: 'studySmartsTasks',
  SETTINGS: 'studySmartsSettings',
  PDF_CACHE: 'studySmartsPdfCache',
};

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'neobrutalist',
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  soundEnabled: true,
};

const SEED_SUBJECTS: Subject[] = [
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
  }
];

const SEED_NOTES: StoredNote[] = [
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
`
  }
];

const SEED_QUIZZES: StoredQuiz[] = [
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
        tags: ['Glycolysis', 'Cell Structure']
      },
      {
        id: 'fc-2',
        question: 'What is the final electron acceptor in the electron transport chain during aerobic respiration?',
        answer: 'Molecular Oxygen (O2). It accepts electrons and combines with protons (H+) to form water (H2O).',
        difficulty: 'Medium',
        tags: ['Oxidative Phosphorylation', 'Biochemistry']
      },
      {
        id: 'fc-3',
        question: 'What enzyme utilizes the proton-motive force across the inner mitochondrial membrane to generate ATP?',
        answer: 'ATP Synthase. Protons flow down their electrochemical gradient through the rotor subunit of ATP Synthase, driving the phosphorylation of ADP to ATP (Chemiosmosis).',
        difficulty: 'Medium',
        tags: ['Enzymes', 'Mitochondria']
      },
      {
        id: 'fc-4',
        question: 'How many net ATP molecules are produced directly by substrate-level phosphorylation per glucose molecule in the Citric Acid Cycle?',
        answer: '2 ATP (or GTP, depending on tissue type), representing 1 ATP per turn of the cycle since 1 glucose yields 2 Acetyl-CoA molecules.',
        difficulty: 'Hard',
        tags: ['Krebs Cycle', 'Bioenergetics']
      },
      {
        id: 'fc-5',
        question: 'What is the primary evolutionary purpose of fermentation in anaerobic conditions?',
        answer: 'To regenerate oxidized NAD+ from reduced NADH, allowing glycolysis to continue producing ATP via substrate-level phosphorylation without oxygen.',
        difficulty: 'Hard',
        tags: ['Fermentation', 'Metabolism']
      }
    ]
  }
];

const SEED_ATTEMPTS: StoredAttempt[] = [
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
        snippet: 'Deep dive into Mitchell\'s chemiosmotic hypothesis and the membrane potentials that power ATP synthesis.'
      },
      {
        title: 'Khan Academy: Regulation of Cellular Respiration and Feedback Loops',
        url: 'https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation',
        snippet: 'Comprehensive tutorial on phosphofructokinase (PFK) allosteric control by ATP and AMP.'
      }
    ],
    examResults: [
      {
        question: 'Which of the following complexes in the ETC does NOT pump protons across the mitochondrial membrane?',
        type: 'multiple_choice',
        correctAnswer: 'Complex II (Succinate Dehydrogenase)',
        userAnswer: 'Complex II (Succinate Dehydrogenase)',
        isCorrect: true,
        topic: 'Electron Transport Chain',
        explanation: 'Complex II receives electrons from FADH2 and transfers them to ubiquinone without pumping protons.'
      },
      {
        question: 'In aerobic eukaryotes, pyruvate dehydrogenase complex is localized in the cytosol.',
        type: 'true_false',
        correctAnswer: 'false',
        userAnswer: 'true',
        isCorrect: false,
        topic: 'Pyruvate Oxidation',
        explanation: 'Pyruvate must first be transported across both mitochondrial membranes into the matrix where the pyruvate dehydrogenase complex resides.'
      }
    ]
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
    topicsToReview: []
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
    topicsToReview: ['Deadlock Coffman Conditions', 'Virtual Memory TLB']
  }
];

const SEED_TASKS: StudyTask[] = [
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

type StorageListener = () => void;
const storageListeners = new Set<StorageListener>();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    storageListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Storage listener error:', e);
      }
    });
  });
}

export const StorageService = {
  subscribe(listener: StorageListener): () => void {
    storageListeners.add(listener);
    return () => {
      storageListeners.delete(listener);
    };
  },

  notify(): void {
    storageListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Storage notify error:', e);
      }
    });
  },

  getSubjects(): Subject[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(SEED_SUBJECTS));
        return SEED_SUBJECTS;
      }
      return JSON.parse(data);
    } catch {
      return SEED_SUBJECTS;
    }
  },

  saveSubjects(subjects: Subject[]): void {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    this.notify();
  },

  getSubject(id: string): Subject | undefined {
    return this.getSubjects().find(s => s.id === id);
  },

  addSubject(
    nameOrObj: string | { name: string; description?: string; code?: string; color?: string },
    description?: string,
    color?: string
  ): Subject {
    const subjects = this.getSubjects();
    let name = '';
    let desc = description;
    let col = color || '#0d9488';
    let code: string | undefined;

    if (typeof nameOrObj === 'object') {
      name = nameOrObj.name;
      desc = nameOrObj.description;
      col = nameOrObj.color || '#0d9488';
      code = nameOrObj.code;
    } else {
      name = nameOrObj;
    }

    const newSubject: Subject = {
      id: `subj-${Date.now()}`,
      name: name.trim(),
      description: desc?.trim(),
      code: code?.trim(),
      color: col,
      createdAt: new Date().toISOString(),
    };
    subjects.unshift(newSubject);
    this.saveSubjects(subjects);
    return newSubject;
  },

  // --- Tasks / Planner ---
  getTasks(subjectId?: string): StudyTask[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      let tasks: StudyTask[] = data ? JSON.parse(data) : [];
      if (!data) {
        tasks = [
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
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      }
      if (subjectId) {
        return tasks.filter(t => t.subjectId === subjectId);
      }
      return tasks;
    } catch {
      return [];
    }
  },

  saveTasks(tasks: StudyTask[]): void {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    this.notify();
  },

  addTask(task: Omit<StudyTask, 'id' | 'createdAt'>): StudyTask {
    const tasks = this.getTasks();
    const newTask: StudyTask = {
      ...task,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  },

  updateTask(id: string, updates: Partial<StudyTask>): StudyTask | null {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates };
    this.saveTasks(tasks);
    return tasks[idx];
  },

  deleteTask(id: string): void {
    const tasks = this.getTasks().filter(t => t.id !== id);
    this.saveTasks(tasks);
  },

  updateSubject(id: string, updates: Partial<Subject>): Subject | null {
    const subjects = this.getSubjects();
    const idx = subjects.findIndex(s => s.id === id);
    if (idx === -1) return null;
    subjects[idx] = { ...subjects[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveSubjects(subjects);
    return subjects[idx];
  },

  deleteSubject(id: string): void {
    const subjects = this.getSubjects().filter(s => s.id !== id);
    this.saveSubjects(subjects);

    // Cascading deletes
    const notes = this.getNotes().filter(n => n.subjectId !== id);
    this.saveNotes(notes);

    const quizzes = this.getQuizzes().filter(q => q.subjectId !== id);
    this.saveQuizzes(quizzes);

    const attempts = this.getAttempts().filter(a => a.subjectId !== id);
    this.saveAttempts(attempts);

    const tasks = this.getTasks().filter(t => t.subjectId !== id);
    this.saveTasks(tasks);
  },

  // --- Notes ---
  getNotes(subjectId?: string): StoredNote[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTES);
      let notes: StoredNote[] = data ? JSON.parse(data) : [];
      if (!data) {
        notes = SEED_NOTES;
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(SEED_NOTES));
      }
      if (subjectId) {
        return notes.filter(n => n.subjectId === subjectId);
      }
      return notes;
    } catch {
      return SEED_NOTES;
    }
  },

  saveNotes(notes: StoredNote[]): void {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    this.notify();
  },

  addNote(note: Omit<StoredNote, 'id' | 'createdAt' | 'updatedAt'>): StoredNote {
    const notes = this.getNotes();
    const newNote: StoredNote = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    this.saveNotes(notes);
    return newNote;
  },

  updateNote(id: string, updates: Partial<StoredNote>): StoredNote | null {
    const notes = this.getNotes();
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    notes[idx] = { ...notes[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveNotes(notes);
    return notes[idx];
  },

  deleteNote(id: string): void {
    const notes = this.getNotes().filter(n => n.id !== id);
    this.saveNotes(notes);
  },

  // --- Quizzes ---
  getQuizzes(subjectId?: string): StoredQuiz[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
      let quizzes: StoredQuiz[] = data ? JSON.parse(data) : [];
      if (!data) {
        quizzes = SEED_QUIZZES;
        localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(SEED_QUIZZES));
      }
      if (subjectId) {
        return quizzes.filter(q => q.subjectId === subjectId);
      }
      return quizzes;
    } catch {
      return SEED_QUIZZES;
    }
  },

  saveQuizzes(quizzes: StoredQuiz[]): void {
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
    this.notify();
  },

  addQuiz(quiz: Omit<StoredQuiz, 'id' | 'createdAt' | 'updatedAt'>): StoredQuiz {
    const quizzes = this.getQuizzes();
    const newQuiz: StoredQuiz = {
      ...quiz,
      id: `quiz-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timesPracticed: 0,
    };
    quizzes.unshift(newQuiz);
    this.saveQuizzes(quizzes);
    return newQuiz;
  },

  updateQuiz(id: string, updates: Partial<StoredQuiz>): StoredQuiz | null {
    const quizzes = this.getQuizzes();
    const idx = quizzes.findIndex(q => q.id === id);
    if (idx === -1) return null;
    quizzes[idx] = { ...quizzes[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveQuizzes(quizzes);
    return quizzes[idx];
  },

  deleteQuiz(id: string): void {
    const quizzes = this.getQuizzes().filter(q => q.id !== id);
    this.saveQuizzes(quizzes);
  },

  // --- Attempts / History ---
  getAttempts(subjectId?: string): StoredAttempt[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
      let attempts: StoredAttempt[] = data ? JSON.parse(data) : [];
      if (!data) {
        attempts = SEED_ATTEMPTS;
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(SEED_ATTEMPTS));
      }
      if (subjectId) {
        return attempts.filter(a => a.subjectId === subjectId);
      }
      return attempts;
    } catch {
      return SEED_ATTEMPTS;
    }
  },

  saveAttempts(attempts: StoredAttempt[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
    this.notify();
  },

  recordAttempt(attempt: Omit<StoredAttempt, 'id' | 'date'>): StoredAttempt {
    const attempts = this.getAttempts();
    const newAttempt: StoredAttempt = {
      ...attempt,
      id: `att-${Date.now()}`,
      date: new Date().toISOString(),
    };
    attempts.unshift(newAttempt);
    this.saveAttempts(attempts);
    return newAttempt;
  },

  deleteAttempt(id: string): void {
    const attempts = this.getAttempts().filter(a => a.id !== id);
    this.saveAttempts(attempts);
  },

  // --- Settings ---
  getSettings(): UserSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.notify();
    return updated;
  },

  // --- Export / Import Backup ---
  exportAllData(): string {
    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      subjects: this.getSubjects(),
      notes: this.getNotes(),
      quizzes: this.getQuizzes(),
      attempts: this.getAttempts(),
      tasks: this.getTasks(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importAllData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.subjects) this.saveSubjects(data.subjects);
      if (data.notes) this.saveNotes(data.notes);
      if (data.quizzes) this.saveQuizzes(data.quizzes);
      if (data.attempts) this.saveAttempts(data.attempts);
      if (data.tasks) this.saveTasks(data.tasks);
      if (data.settings) this.saveSettings(data.settings);
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to import backup data:', e);
      return false;
    }
  },

  resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(SEED_SUBJECTS));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(SEED_NOTES));
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(SEED_QUIZZES));
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(SEED_ATTEMPTS));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(SEED_TASKS));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    this.notify();
  }
};
