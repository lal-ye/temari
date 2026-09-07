import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  FileText,
  Github,
  GraduationCap,
  KeyRound,
  Layers,
  TrendingUp,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { AI_PROVIDERS } from '../../../shared/aiCatalog';
import { BLOOM_LEVELS, type BloomLevel } from '../../types';
import { AsciiField } from './AsciiField';
import { TEMARI_PALETTE } from './asciiFieldMath';

/**
 * The public landing page (docs/ui-plan-landing-page.md).
 *
 * Rules this file follows, in order of how easy they are to break:
 *
 *   - It never imports the store, the AI module or App.tsx. Opening `/` must
 *     not create a localStorage key or download recharts.
 *   - Every claim maps to a shipped feature, and every number comes from the
 *     code (BLOOM_LEVELS, AI_PROVIDERS), not from a marketing figure.
 *   - Copy uses the CONTEXT.md nouns: Subject, Material, Note, Quiz, Exam,
 *     Attempt, Cognitive Level, Provider, BYOK, Offline generation.
 *   - The ASCII field is the only continuous animation on the page.
 */

const REPO_URL = 'https://github.com/lal-ye/temari';

interface LandingPageProps {
  /** Pushes `/app`; wired by Root so the page never touches history itself. */
  onOpenApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenApp }) => (
  <div className="min-h-screen bg-background text-foreground font-body">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:bg-amber-100 focus:border focus:border-amber-500/40 focus:rounded-md focus:text-sm focus:font-semibold"
    >
      Skip to content
    </a>

    <TopBar onOpenApp={onOpenApp} />

    <main id="main">
      <Hero onOpenApp={onOpenApp} />
      <Loop />
      <CognitiveLevels />
      <BringYourOwnKey />
    </main>

    <Footer onOpenApp={onOpenApp} />
  </div>
);

/* ------------------------------------------------------------------------ */
/* Shared bits                                                               */
/* ------------------------------------------------------------------------ */

/** Same brand block as the app header, so `/` and `/app` read as one product. */
const Brand: React.FC = () => (
  <span className="flex items-center gap-2 shrink-0">
    <span className="w-8 h-8 bg-primary text-primary-foreground rounded-lg border border-border/60 flex items-center justify-center font-ethiopic font-bold text-sm shadow-xs">
      ተ
    </span>
    <span className="font-editorial text-base font-bold tracking-tight leading-none">Temari</span>
  </span>
);

/* Editorial CTA buttons (ADR-0010). Mirror the app's <Button> treatments so
   the landing chrome matches the study shell; kept inline here to preserve
   the page's no-app-imports rule (ui/button has no study dependencies). */
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-5 h-11 text-sm font-semibold shadow-xs whitespace-nowrap transition-colors';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted px-5 h-11 text-sm font-semibold shadow-xs whitespace-nowrap transition-colors';

const SectionHeading: React.FC<{
  id: string;
  kicker: string;
  title: string;
  children?: React.ReactNode;
}> = ({ id, kicker, title, children }) => (
  <div className="max-w-2xl">
    <p className="badge-chip text-amber-600 dark:text-amber-400">{kicker}</p>
    <h2 id={id} className="font-editorial text-3xl sm:text-4xl font-bold tracking-tight mt-2">
      {title}
    </h2>
    {children && <p className="text-base sm:text-lg text-muted-foreground mt-3 leading-relaxed">{children}</p>}
  </div>
);

/* ------------------------------------------------------------------------ */
/* Top bar                                                                   */
/* ------------------------------------------------------------------------ */

const TopBar: React.FC<{ onOpenApp: () => void }> = ({ onOpenApp }) => (
  <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      <Brand />
      <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="GitHub repository"
        >
          <Github className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">
            GitHub
          </span>
        </a>
        <button
          type="button"
          onClick={onOpenApp}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-600 px-3.5 h-9 text-sm font-semibold shadow-xs transition-colors"
        >
          Open Temari
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </header>
);

/* ------------------------------------------------------------------------ */
/* Hero                                                                      */
/* ------------------------------------------------------------------------ */

const Hero: React.FC<{ onOpenApp: () => void }> = ({ onOpenApp }) => (
  <section className="relative overflow-hidden border-b border-border" aria-labelledby="hero-title">
    {/* The reference's "hero background" arrangement: field dim at rest,
        the cursor is what lights it up. Raised on touch, where there is no
        cursor to earn it with. */}
    <AsciiField
      className="absolute inset-0"
      palette={TEMARI_PALETTE}
      baseOpacity={0.16}
      coarsePointerOpacity={0.3}
      spotlightOpacity={0.85}
      spotlightRadius={10}
      rippleStrength={1.4}
      rippleRadius={6}
      fontSize={12}
      frameMs={60}
    />

    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* A solid plate keeps the headline legible over the brightened field
          instead of relying on the glyphs staying dim. */}
      <div className="max-w-3xl bg-card border border-border/80 rounded-2xl shadow-xs p-6 sm:p-10">
        <p className="font-ethiopic text-5xl sm:text-7xl font-bold leading-none tracking-tight text-amber-600 dark:text-amber-400" lang="am">
          ተማሪ
        </p>
        <h1 id="hero-title" className="font-editorial text-3xl sm:text-5xl font-bold tracking-tight mt-4 leading-[1.05]">
          Study material in, understanding out.
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mt-5 leading-relaxed max-w-xl">
          Temari turns the Material you already have into Notes, Flashcard Quizzes and
          Exams, then grades every Attempt by Cognitive Level so you can see what you
          remember and what you actually understand. Runs in your browser. Your data
          stays on your device.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button type="button" onClick={onOpenApp} className={primaryButton}>
            Open Temari
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={secondaryButton}>
            <Github className="w-4 h-4" aria-hidden="true" />
            View on GitHub
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-5 font-medium">
          No account. Bring your own Provider key, or start with offline drafts.
        </p>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------------ */
/* The loop                                                                  */
/* ------------------------------------------------------------------------ */

interface LoopStep {
  icon: LucideIcon;
  noun: string;
  body: string;
}

const LOOP: LoopStep[] = [
  {
    icon: FileText,
    noun: 'Material',
    body: 'Paste text or upload a PDF under a Subject. That raw text is what everything else is generated from.',
  },
  {
    icon: BookOpen,
    noun: 'Notes',
    body: 'Markdown study documents with callouts and editorial diagrams. Long-press any term for an explanation in context.',
  },
  {
    icon: Layers,
    noun: 'Quizzes',
    body: 'Decks of Flashcards for active recall. Swipe to move on, rate a card and it records an Attempt.',
  },
  {
    icon: GraduationCap,
    noun: 'Exams',
    body: 'Multiple choice, true or false and short answer, planned over Knowledge Units so coverage is deliberate, not whatever the Material emphasised.',
  },
  {
    icon: TrendingUp,
    noun: 'Analytics',
    body: 'Topic accuracy, mastery per Cognitive Level, and a Review Queue that resurfaces what you got wrong at expanding intervals.',
  },
];

const Loop: React.FC = () => (
  <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24" aria-labelledby="loop-title">
    <SectionHeading id="loop-title" kicker="The loop" title="Five nouns, in the order you meet them.">
      Every screen in Temari is one of these. There is nothing else to learn.
    </SectionHeading>

    <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {LOOP.map((step, index) => (
        <li
          key={step.noun}
          className="relative bg-card border border-border/80 rounded-2xl shadow-xs p-5 flex flex-col"
        >
          <div className="flex items-center justify-between">
            <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <step.icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
              0{index + 1}
            </span>
          </div>
          <h3 className="font-editorial text-xl font-bold mt-4">{step.noun}</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{step.body}</p>
        </li>
      ))}
    </ol>

    <p className="mt-6 text-sm text-muted-foreground flex items-center gap-2">
      <Calendar className="w-4 h-4" aria-hidden="true" />
      Plus a Planner for Study Tasks and a focus timer, because the loop still needs a schedule.
    </p>
  </section>
);

/* ------------------------------------------------------------------------ */
/* Cognitive levels                                                          */
/* ------------------------------------------------------------------------ */

/**
 * The same tones as `BloomBadge` in the app. Restated here rather than
 * imported because BloomBadge pulls in the Exam-Blueprint module, and the
 * landing chunk must stay free of study code. If the tones change there,
 * change them here.
 */
const LEVEL_TONE: Record<BloomLevel, string> = {
  remember: 'bg-slate-100 text-slate-700 border-slate-300',
  understand: 'bg-sky-50 text-sky-800 border-sky-300',
  apply: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  analyze: 'bg-amber-50 text-amber-800 border-amber-300',
  evaluate: 'bg-rose-50 text-rose-800 border-rose-300',
  create: 'bg-violet-50 text-violet-800 border-violet-300',
};

const LEVEL_EXAMPLE: Record<BloomLevel, string> = {
  remember: 'State the three stages of cellular respiration.',
  understand: 'Explain why the Krebs cycle needs oxygen indirectly.',
  apply: 'Predict ATP yield if the electron transport chain is blocked.',
  analyze: 'Compare fermentation and aerobic respiration by efficiency.',
  evaluate: 'Judge whether a cell in hypoxia should favour glycolysis.',
  create: 'Design an experiment that isolates oxidative phosphorylation.',
};

const CognitiveLevels: React.FC = () => (
  <section className="bg-card border-y border-border" aria-labelledby="levels-title">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <SectionHeading
        id="levels-title"
        kicker="Cognitive levels"
        title="A question's format says nothing about its level."
      >
        A multiple choice question can ask you to recall a date or to evaluate an
        argument. Temari records where every question sits on Bloom's Taxonomy, plans
        each Exam against a quota of levels, and grades every answer at that level.
        Mastery is measurable per topic and per level, not just per Subject.
      </SectionHeading>

      <ol className="grid gap-2.5">
        {BLOOM_LEVELS.map((level, index) => (
          <li
            key={level}
            className="grid grid-cols-[auto_1fr] items-center gap-4 bg-background border border-border/80 rounded-lg px-4 py-3"
          >
            <span
              className={`badge-chip inline-flex items-center justify-center rounded-md border px-2 py-1 min-w-[6.5rem] ${LEVEL_TONE[level]}`}
            >
              {index + 1}. {level}
            </span>
            <span className="text-sm text-foreground/90">{LEVEL_EXAMPLE[level]}</span>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

/* ------------------------------------------------------------------------ */
/* Bring your own key                                                        */
/* ------------------------------------------------------------------------ */

const BringYourOwnKey: React.FC = () => {
  // The catalog is the single source of truth for Providers (ADR-0003); the
  // page reads it rather than restating a list that would drift.
  const providers = AI_PROVIDERS;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24" aria-labelledby="byok-title">
      <SectionHeading id="byok-title" kicker="Bring your own key" title={`${providers.length} Providers, your key, your choice of Model.`}>
        Generation runs through whichever Provider you pick, with a key you supply in
        settings. Keys live in your browser's storage and are sent only to the
        Provider you chose. Self-hosted models over an OpenAI-compatible endpoint
        work too.
      </SectionHeading>

      <ul className="mt-8 flex flex-wrap gap-2">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="inline-flex items-center gap-2 bg-card border border-border/80 rounded-lg px-3.5 h-10 text-sm font-semibold shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            {provider.name}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="bg-card border border-border/80 border-t-2 border-t-emerald-500/60 rounded-2xl shadow-xs p-6">
          <h3 className="font-editorial text-xl font-bold">Local first</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Subjects, Notes, Quizzes, Attempts and Study Tasks persist in your browser.
            There is no account, no sync service and nothing to delete when you leave.
          </p>
        </div>
        <div className="bg-card border border-border/80 border-t-2 border-t-amber-500/60 rounded-2xl shadow-xs p-6">
          <h3 className="font-editorial text-xl font-bold flex items-center gap-2">
            <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Honest offline drafts
          </h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            With no Provider reachable, Temari still produces placeholder Notes and
            questions on your device, and always labels them as offline drafts. It never
            passes them off as Provider output.
          </p>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------------ */
/* Footer                                                                    */
/* ------------------------------------------------------------------------ */

const Footer: React.FC<{ onOpenApp: () => void }> = ({ onOpenApp }) => (
  <footer className="border-t border-border bg-card">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      <div>
        <Brand />
        <p className="text-xs text-muted-foreground mt-3 max-w-md leading-relaxed">
          Temari (ተማሪ) is Amharic for student. Public on GitHub. The hero field is a port
          of performative-ui's AsciiHero, MIT licensed.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
        >
          <Github className="w-4 h-4" aria-hidden="true" />
          Repository
        </a>
        <button type="button" onClick={onOpenApp} className={primaryButton}>
          Open Temari
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </footer>
);
