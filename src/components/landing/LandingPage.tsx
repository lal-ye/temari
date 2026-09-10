import React from 'react';
import { ExternalLink, ArrowRight, Terminal } from 'lucide-react';
import { AsciiSurface } from './AsciiSurface';
import { AI_PROVIDERS } from '../../../shared/aiCatalog';
import { BLOOM_LEVELS, type BloomLevel } from '../../types';

/**
 * Variation 10 — Cognitive Study Engine (landing / display variant).
 *
 * The landing page is the documented marketing-only language (ADR-0011): it
 * may be louder than the study shell, but it shares the token spine. Every
 * colour below is a `var(--landing-*)` token defined in `src/index.css`; the
 * `landingDesignSystem` guard fails this file if a raw hex, an inline
 * colour/font style, or a non-interactive click target appears here.
 *
 * Composition (audit §3 Layer 4, answering A3): the ASCII field is a
 * full-width *band* under the wordmark — a region it owns — and the panels
 * start below it. Nothing on the page sits on top of the field.
 *
 * The field itself is a port of performative-ui's AsciiHero (MIT);
 * attribution is rendered in the left panel footer per ADR-0009.
 */

const REPO_URL = 'https://github.com/lal-ye/temari';

interface LandingPageProps {
  /** Pushes `/app`; wired by Root so the page never touches history itself. */
  onOpenApp: () => void;
}

/** One honest example Exam prompt per Cognitive Level; identities come from
 *  `BLOOM_LEVELS` (src/types.ts), never from a hand-typed list. Shown at rest,
 *  so nothing on the page is hover-only. */
const BLOOM_EXAMPLES: Record<BloomLevel, string> = {
  remember: 'State the three stages of cellular respiration.',
  understand: 'Explain why the Krebs cycle needs oxygen indirectly.',
  apply: 'Predict ATP yield if the electron transport chain is blocked.',
  analyze: 'Compare fermentation and aerobic respiration by efficiency.',
  evaluate: 'Judge whether a cell in hypoxia should favour glycolysis.',
  create: 'Design an experiment that isolates oxidative phosphorylation.',
};

interface StageItem {
  noun: string;
  detail: string;
}

/** The first three glossary nouns a learner meets, in order. */
const STAGES: StageItem[] = [
  { noun: 'Material', detail: 'PDFs & Text' },
  { noun: 'Notes', detail: 'Breakdown' },
  { noun: 'Quizzes', detail: 'Recall' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenApp }) => {
  const providerSummary = AI_PROVIDERS.map((p) => p.id.toUpperCase()).join(', ');

  return (
    <div className="w-full min-h-screen bg-[var(--landing-page)] text-[var(--landing-ink)] selection:bg-[var(--landing-accent)] selection:text-[var(--landing-page)] font-space-mono p-5 sm:p-8 lg:p-10 flex flex-col gap-6 sm:gap-8">
      <a
        href="#main-engine"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--landing-accent)] focus:text-[var(--landing-page)] focus:font-bold focus:text-xs focus:tracking-wider focus:outline-hidden"
      >
        Skip to content
      </a>

      {/* Masthead: identity above the field. Ethiopic is first-class — the
          wordmark uses the self-hosted face, never a platform fallback. */}
      <header className="w-full max-w-[1700px] mx-auto flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="font-ethiopic font-bold text-5xl sm:text-7xl lg:text-[7.5rem] leading-[0.85] tracking-[-0.04em] text-[var(--landing-accent)] select-none">
          ተማሪ
        </div>
        <p className="text-[0.65rem] sm:text-xs tracking-[0.3em] uppercase text-[var(--landing-muted)] pb-2 sm:pb-4">
          Cognitive Study Engine
        </p>
      </header>

      {/* The band: a region the field owns (A3). Alphas are solved from the
          --landing-* tokens by the contrast model (audit §3 Layer 2) — no
          hand-picked opacity numbers on this page. */}
      <AsciiSurface className="w-full max-w-[1700px] mx-auto border border-[var(--landing-ink)]" />

      {/* Panels start below the field; nothing sits on top of it. */}
      <div
        id="main-engine"
        className="w-full max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 flex-1"
      >
        {/* Left Column */}
        <section
          aria-label="Engine Overview"
          className="border border-[var(--landing-ink)] p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8 bg-[var(--landing-panel)]"
        >
          {/* Core Pitch */}
          <div className="my-auto py-4 lg:py-6">
            <p className="text-xs sm:text-sm text-[var(--landing-muted)] leading-[1.65] max-w-[440px] mb-8">
              Temari turns material into notes and quizzes, grading every attempt by cognitive level
              so you can differentiate between memory and true comprehension. Private, browser-based,
              and local-first.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
              <button
                type="button"
                onClick={onOpenApp}
                className="btn-kinetic inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 border-2 border-[var(--landing-ink)] bg-[var(--landing-ink)] text-[var(--landing-page)] font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors duration-150 hover:bg-[var(--landing-accent)] hover:border-[var(--landing-accent)] hover:text-[var(--landing-page)] active:scale-[0.99] cursor-pointer"
              >
                <span>Launch Engine</span>
                <ArrowRight className="w-4 h-4 ml-2.5 shrink-0" aria-hidden="true" />
              </button>

              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-kinetic inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 border-2 border-[var(--landing-ink)] bg-transparent text-[var(--landing-ink)] font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors duration-150 hover:bg-[var(--landing-ink)] hover:text-[var(--landing-page)] active:scale-[0.99]"
              >
                <span>View Source</span>
                <ExternalLink className="w-3.5 h-3.5 ml-2.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Attribution footer (ADR-0009): the ported hook is credited on the
              page, and the repository is linked truthfully. */}
          <footer className="pt-6 border-t border-[var(--landing-rule)] text-[0.65rem] leading-relaxed text-[var(--landing-dim)]">
            <p>ASCII field ported from performative-ui (MIT licence).</p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-[var(--landing-accent)]"
            >
              Public on GitHub
            </a>
          </footer>
        </section>

        {/* Right Column */}
        <section
          aria-label="Workflow and Diagnostics"
          className="right-col grid grid-rows-[auto_1fr_auto] gap-5 h-full"
        >
          {/* 1. Workflow Index Card */}
          <div className="card border border-[var(--landing-ink)] p-5 bg-[var(--landing-panel)]">
            <h2 className="text-xs sm:text-sm font-bold tracking-wider mb-4 uppercase flex items-center justify-end">
              <span className="text-[0.6rem] font-normal tracking-widest text-[var(--landing-accent)]">
                03_STAGES
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-3 sm:gap-5 divide-x divide-[var(--landing-rule)] -ml-2 sm:-ml-3 pl-2 sm:pl-3">
              {STAGES.map((s) => (
                <div key={s.noun} className="px-2 sm:px-4">
                  <strong className="block text-xs sm:text-sm font-bold mb-0.5">{s.noun}</strong>
                  <p className="text-[0.7rem] text-[var(--landing-muted)] leading-tight">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Dashboard Grid (Bloom's Taxonomy 6-Card Array). Real buttons:
              keyboard-reachable, focusable, and the full prompt is visible at
              rest so nothing is hover-only. */}
          <div className="dashboard-grid grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 content-stretch">
            {BLOOM_LEVELS.map((level, idx) => (
              <button
                key={level}
                type="button"
                onClick={onOpenApp}
                title={`Launch engine to practice: ${BLOOM_EXAMPLES[level]}`}
                className="card border border-[var(--landing-ink)] p-4 sm:p-5 flex flex-col justify-between bg-[var(--landing-panel)] hover:bg-[var(--landing-ink)] hover:text-[var(--landing-page)] transition-colors duration-150 cursor-pointer group text-left w-full"
              >
                <div>
                  <span className="text-[var(--landing-accent)] group-hover:text-[var(--landing-accent)] font-bold text-[0.6rem] sm:text-[0.65rem] tracking-wider block mb-2 uppercase">
                    {level}
                  </span>
                  <p className="text-[0.7rem] sm:text-xs leading-relaxed text-[var(--landing-muted)] group-hover:text-[var(--landing-onink)] font-medium">
                    {BLOOM_EXAMPLES[level]}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity text-[0.6rem] uppercase tracking-widest text-[var(--landing-dim)] group-hover:text-[var(--landing-onink)]">
                  <span>COGNITIVE_L0{idx + 1}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--landing-accent)]" aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>

          {/* 3. Status Bar. Provider identity comes from the shared catalog
              (ADR-0003), never a hand-typed list. */}
          <div className="status-bar border-t border-[var(--landing-ink)] pt-4 sm:pt-5 flex items-center justify-between text-[0.7rem] font-medium bg-[var(--landing-panel)]">
            <span className="flex items-center gap-1.5 tracking-tight text-[var(--landing-ink)]">
              <Terminal className="w-3.5 h-3.5 text-[var(--landing-accent)] shrink-0" aria-hidden="true" />
              PROVIDERS: [{providerSummary}]
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
