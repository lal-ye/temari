import React, { useState } from 'react';
import { ExternalLink, ArrowRight, Terminal } from 'lucide-react';
import { AsciiHero } from './AsciiHero';

/**
 * Variation 10 — Cognitive Study Engine
 *
 * Neo-brutalist / industrial academic editorial design with Syne (800) and
 * Space Mono (400, 700) backed by an optimized, performative procedural ASCII
 * hero shader reacting to cursor coordinates.
 *
 * Palette:
 *   --bg: #F8F7F4
 *   --ink: #111113
 *   --accent: #E33E33
 */

const REPO_URL = 'https://github.com/lal-ye/temari';

interface LandingPageProps {
  /** Pushes `/app`; wired by Root so the page never touches history itself. */
  onOpenApp: () => void;
}

interface BloomItem {
  level: string;
  shortSnippet: string;
  fullPrompt: string;
}

const BLOOM_CARDS: BloomItem[] = [
  {
    level: 'REMEMBER',
    shortSnippet: 'State the stages...',
    fullPrompt: 'State the three stages of cellular respiration.',
  },
  {
    level: 'UNDERSTAND',
    shortSnippet: 'Explain why...',
    fullPrompt: 'Explain why the Krebs cycle needs oxygen indirectly.',
  },
  {
    level: 'APPLY',
    shortSnippet: 'Predict yield...',
    fullPrompt: 'Predict ATP yield if the electron transport chain is blocked.',
  },
  {
    level: 'ANALYZE',
    shortSnippet: 'Efficiency...',
    fullPrompt: 'Compare fermentation and aerobic respiration by efficiency.',
  },
  {
    level: 'EVALUATE',
    shortSnippet: 'Judge cell...',
    fullPrompt: 'Judge whether a cell in hypoxia should favour glycolysis.',
  },
  {
    level: 'CREATE',
    shortSnippet: 'Experiment design...',
    fullPrompt: 'Design an experiment that isolates oxidative phosphorylation.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenApp }) => {
  const [activeBloomIndex, setActiveBloomIndex] = useState<number | null>(null);

  return (
    <div
      style={{ position: 'relative' }}
      className="w-full min-h-screen lg:h-screen lg:overflow-hidden bg-[#F8F7F4] text-[#111113] selection:bg-[#E33E33] selection:text-[#F8F7F4] font-space-mono p-5 sm:p-8 lg:p-10"
    >
      <AsciiHero
        variant="bare"
        colorful
        baseOpacity={0.18}
        spotlightOpacity={0.9}
        spotlightRadius={10}
        style={{ position: 'absolute', inset: 0 }}
      />

      <a
        href="#main-engine"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#E33E33] focus:text-[#F8F7F4] focus:font-bold focus:text-xs focus:tracking-wider focus:outline-hidden"
      >
        Skip to content
      </a>

      {/* Responsive Shell Grid: 1 col on mobile/tablet, 2 cols on lg desktop */}
      <div
        id="main-engine"
        style={{ position: 'relative', zIndex: 1 }}
        className="h-full w-full max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10"
      >
        {/* ================================================================ */}
        {/* Left Column                                                      */}
        {/* ================================================================ */}
        <section
          aria-label="Engine Overview"
          className="border border-[#111113] p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8 lg:gap-0 bg-[#F8F7F4]/90 backdrop-blur-xs"
        >
          {/* Brand Mark */}
          <div
            className="brand font-syne font-extrabold text-6xl sm:text-7xl lg:text-[7.5rem] xl:text-[8rem] leading-[0.8] tracking-[-0.04em] text-[#E33E33] select-none"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#E33E33',
              lineHeight: 0.8,
              letterSpacing: '-0.04em',
            }}
          >
            ተማሪ
          </div>

          {/* Core Pitch */}
          <div className="my-auto py-4 lg:py-6">
            <p className="text-xs sm:text-sm text-[#111113] leading-[1.65] max-w-[440px] mb-8">
              Temari turns material into notes and quizzes, grading every attempt by cognitive level
              so you can differentiate between memory and true comprehension. Private, browser-based,
              and local-first.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
              <button
                type="button"
                onClick={onOpenApp}
                className="btn btn-primary inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 border-2 border-[#111113] bg-[#111113] text-[#F8F7F4] font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors duration-150 hover:bg-[#E33E33] hover:border-[#E33E33] hover:text-[#F8F7F4] active:scale-[0.99] cursor-pointer"
                style={{
                  backgroundColor: '#111113',
                  color: '#F8F7F4',
                }}
              >
                <span>LAUNCH ENGINE</span>
                <ArrowRight className="w-4 h-4 ml-2.5 shrink-0" aria-hidden="true" />
              </button>

              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 border-2 border-[#111113] bg-transparent text-[#111113] font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors duration-150 hover:bg-[#111113] hover:text-[#F8F7F4] active:scale-[0.99]"
              >
                <span>VIEW SOURCE</span>
                <ExternalLink className="w-3.5 h-3.5 ml-2.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* Right Column                                                     */}
        {/* ================================================================ */}
        <section
          aria-label="Workflow and Diagnostics"
          className="right-col grid grid-rows-[auto_1fr_auto] gap-5 h-full"
        >
          {/* 1. Workflow Index Card */}
          <div className="card border border-[#111113] p-5 bg-[#F8F7F4]/90 backdrop-blur-xs">
            <h2 className="text-xs sm:text-sm font-bold tracking-wider mb-4 uppercase flex items-center justify-end">
              <span className="text-[0.65rem] font-normal tracking-widest text-[#E33E33]">
                03_STAGES
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-3 sm:gap-5 divide-x divide-[#111113]/20 -ml-2 sm:-ml-3 pl-2 sm:pl-3">
              <div className="pr-2 sm:pr-4">
                <strong className="block text-xs sm:text-sm font-bold mb-0.5">Material</strong>
                <p className="text-[0.7rem] text-[#111113]/80 leading-tight">PDFs &amp; Text</p>
              </div>
              <div className="pl-3 sm:pl-5 pr-2 sm:pr-4">
                <strong className="block text-xs sm:text-sm font-bold mb-0.5">Notes</strong>
                <p className="text-[0.7rem] text-[#111113]/80 leading-tight">Breakdown</p>
              </div>
              <div className="pl-3 sm:pl-5">
                <strong className="block text-xs sm:text-sm font-bold mb-0.5">Quizzes</strong>
                <p className="text-[0.7rem] text-[#111113]/80 leading-tight">Recall</p>
              </div>
            </div>
          </div>

          {/* 2. Dashboard Grid (Bloom's Taxonomy 6-Card Array) */}
          <div className="dashboard-grid grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 content-stretch">
            {BLOOM_CARDS.map((card, idx) => {
              const isHovered = activeBloomIndex === idx;
              return (
                <div
                  key={card.level}
                  onMouseEnter={() => setActiveBloomIndex(idx)}
                  onMouseLeave={() => setActiveBloomIndex(null)}
                  className="card border border-[#111113] p-4 sm:p-5 flex flex-col justify-between bg-[#F8F7F4]/90 backdrop-blur-xs hover:bg-[#111113] hover:text-[#F8F7F4] transition-colors duration-150 cursor-pointer group"
                  onClick={onOpenApp}
                  title={`Launch engine to practice: ${card.fullPrompt}`}
                >
                  <div>
                    <span
                      className="tag text-[#E33E33] group-hover:text-[#E33E33] font-bold text-[0.6rem] sm:text-[0.65rem] tracking-wider block mb-2 uppercase"
                      style={{ color: '#E33E33' }}
                    >
                      {card.level}
                    </span>
                    <p className="text-[0.7rem] sm:text-xs leading-relaxed text-[#111113] group-hover:text-[#F8F7F4] font-medium">
                      {isHovered ? card.fullPrompt : card.shortSnippet}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity text-[0.6rem] uppercase tracking-widest text-[#F8F7F4]/70">
                    <span>COGNITIVE_L0{idx + 1}</span>
                    <ArrowRight className="w-3 h-3 text-[#E33E33]" aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. Status Bar */}
          <div className="status-bar border-t border-[#111113] pt-4 sm:pt-5 flex items-center justify-between text-[0.7rem] font-medium bg-[#F8F7F4]/90 backdrop-blur-xs">
            <span className="flex items-center gap-1.5 tracking-tight text-[#111113]">
              <Terminal className="w-3.5 h-3.5 text-[#E33E33] shrink-0" aria-hidden="true" />
              PROVIDERS: [GEMINI, OPENAI, CLAUDE, GROQ]
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
