import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  studyStore,
  useActiveSubject,
  useActiveSubjectId,
  useAllAttempts,
  useSettings,
  useSubjects,
} from './hooks/useStudyStore';
import { computeStudyStreak } from './utils/analytics';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { SkeletonAnalytics } from './components/ui/Skeleton';
import { CommandPalette, type Command } from './components/ui/CommandPalette';
import { SubjectSwitcher } from './components/nav/SubjectSwitcher';
import { StreakPill } from './components/nav/StreakPill';
import { HubTabs, HubBottomBar } from './components/nav/HubTabs';
import { NotesManager } from './components/notes/NotesManager';
import { QuizzesManager } from './components/quizzes/QuizzesManager';
import { ExamsManager } from './components/exams/ExamsManager';
import { PlannerView } from './components/planner/PlannerView';
import { PomodoroTimer } from './components/tools/PomodoroTimer';
import { ExplainTermModal } from './components/tools/ExplainTermModal';
import { ApiKeySettingsModal } from './components/tools/ApiKeySettingsModal';
import { ModelPicker } from './components/tools/ModelPicker';
import { Modal, type MorphOrigin } from './components/ui/Modal';
import { useModalOrigin } from './components/ui/useModalOrigin';
import {
  prefersReducedMotion,
  runViewTransition,
  type InteractionOrigin,
} from './utils/viewTransition';
import {
  BookOpen,
  Layers,
  GraduationCap,
  TrendingUp,
  Calendar,
  Clock,
  Key,
  FolderPlus,
  Trash2,
  X,
  Search,
} from 'lucide-react';

/** AnalyticsView pulls in recharts (~200kB gzip); load it only when opened. */
const AnalyticsView = lazy(() =>
  import('./components/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);

type TabType = 'notes' | 'quizzes' | 'exams' | 'analytics' | 'planner';

/** Which app-level modal is open — one state instead of one boolean per modal. */
type OpenModal = 'api-key' | 'pomodoro' | 'add-subject' | null;

export default function App() {
  const subjects = useSubjects();
  const currentSubject = useActiveSubject();
  const activeSubjectId = useActiveSubjectId();
  const deleteSubject = studyStore.deleteSubject;

  const settings = useSettings();

  // Streak is derived from Attempts across every Subject, not the active one:
  // studying anything today counts as studying.
  const isOnline = useOnlineStatus();
  const allAttempts = useAllAttempts();
  const streak = useMemo(() => computeStudyStreak(allAttempts), [allAttempts]);
  const streakMessage = useMemo(() => {
    if (streak.days === 0) return 'Finish a drill or exam to start a streak.';
    if (streak.daysThisWeek >= 7) return 'Every day this week. Take a rest day if you need one.';
    if (!streak.studiedToday) return 'Study today to keep the streak going.';
    const remaining = 7 - streak.daysThisWeek;
    return `${remaining} more ${remaining === 1 ? 'day' : 'days'} this week to make it a full seven.`;
  }, [streak]);

  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Label the shortcut the way the learner's own keyboard does. */
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  /** Suppresses indicator travel on the keyboard path (keys 1-5). */
  const navAnimateRef = useRef(false);

  // Modals and Drawers
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  // Whichever control opened the current app-level modal, so it can morph from it.
  const modalOrigin = useModalOrigin();
  const explainOrigin = useModalOrigin();
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);
  const [explainTermData, setExplainTermData] = useState<{ term: string; context?: string } | null>(
    null
  );
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectAmharicName, setNewSubjectAmharicName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#2563eb');

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    // The store creates the subject and makes it the active subject.
    studyStore.addSubject({
      name: newSubjectName.trim(),
      amharicName: newSubjectAmharicName.trim() || undefined,
      code: newSubjectCode.trim() || undefined,
      color: newSubjectColor,
    });

    setNewSubjectName('');
    setNewSubjectAmharicName('');
    setNewSubjectCode('');
    setOpenModal(null);
  };

  /**
   * Lateral navigation. Pointer opens cross-fade (ADR-0004); keyboard opens are
   * instant — keys 1-5 are used many times a session and an animation the
   * learner did not ask to watch is pure latency.
   */
  const handleTabChange = (tab: TabType, origin: InteractionOrigin = 'pointer') => {
    if (tab === activeTab) return;
    navAnimateRef.current = origin === 'pointer';
    runViewTransition(() => setActiveTab(tab), { origin });
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // The delete button is hidden when one Subject remains; guard anyway.
    if (subjects.length <= 1) return;
    setConfirmDeleteSubjectId(id);
  };

  const handleHighlightExplain = (term: string, context?: string, origin?: MorphOrigin) => {
    // The explainer grows out of the word the learner pressed, not the centre
    // of the screen, so the answer is visibly about *that* term.
    explainOrigin.capture(origin ?? null);
    setExplainTermData({ term, context });
  };

  const navItems = [
    { id: 'notes', label: 'Interactive Notes', icon: BookOpen },
    { id: 'quizzes', label: 'Flashcard Quizzes', icon: Layers },
    { id: 'exams', label: 'Mock Exams', icon: GraduationCap },
    { id: 'analytics', label: 'Analytics & Progress', icon: TrendingUp },
    { id: 'planner', label: 'Study Planner', icon: Calendar },
  ];

  /**
   * Every navigation and creation action, reachable from one keystroke. The
   * palette is the fast path for returning learners; the sidebar stays the
   * discoverable one.
   */
  const commands: Command[] = [
    ...navItems.map((item, index) => ({
      id: `go-${item.id}`,
      label: item.label,
      group: 'Go to',
      icon: item.icon,
      hint: String(index + 1),
      run: () => handleTabChange(item.id as TabType, 'keyboard'),
    })),
    {
      id: 'new-subject',
      label: 'Add a subject',
      group: 'Create',
      icon: FolderPlus,
      keywords: 'course new',
      run: () => {
        modalOrigin.capture(null);
        setOpenModal('add-subject');
      },
    },
    {
      id: 'pomodoro',
      label: 'Start a focus timer',
      group: 'Tools',
      icon: Clock,
      keywords: 'pomodoro study session',
      run: () => {
        modalOrigin.capture(null);
        setOpenModal('pomodoro');
      },
    },
    {
      id: 'settings',
      label: 'AI providers and models',
      group: 'Tools',
      icon: Key,
      keywords: 'api key byok settings model',
      run: () => {
        modalOrigin.capture(null);
        setOpenModal('api-key');
      },
    },
  ];

  // Desktop keyboard navigation (1-5 for study hubs, Escape to close drawer/modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K works from anywhere, including inside a text field: it is
      // the one shortcut a learner should never have to click out of first.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // The palette owns the keyboard while it is open.
      if (paletteOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (openModal || confirmDeleteSubjectId || explainTermData) {
        if (e.key === 'Escape') {
          setOpenModal(null);
          setConfirmDeleteSubjectId(null);
          setExplainTermData(null);
        }
        return;
      }

      const shortcutTabs: Record<string, TabType> = {
        '1': 'notes',
        '2': 'quizzes',
        '3': 'exams',
        '4': 'analytics',
        '5': 'planner',
      };

      const shortcutTab = shortcutTabs[e.key];
      if (shortcutTab) {
        // Keyboard path: no view transition, no indicator travel.
        handleTabChange(shortcutTab, 'keyboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal, confirmDeleteSubjectId, explainTermData, activeTab, paletteOpen]);

  return (
    <div className="app-layout h-screen w-full bg-[#F1F5F9] text-slate-800 font-sans overflow-hidden">

      {/* Main Content View Container */}
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <header className="app-header bg-white border-b-3 border-slate-900 flex items-center justify-between gap-3 px-3 sm:px-5 py-2 shrink-0 z-10 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Brand. With the sidebar gone this is the only place the app
                names itself, so it stays visible down to the smallest width. */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-slate-900 text-yellow-300 rounded-xl border-2 border-slate-900 flex items-center justify-center font-ethiopic font-black text-sm shadow-neo-sm">
                ተ
              </div>
              <h1 className="hidden sm:block font-editorial text-base font-bold text-slate-950 tracking-tight leading-none">
                Temari
              </h1>
            </div>

            <div className="h-6 w-0.5 bg-slate-200 shrink-0 hidden sm:block" />

            <SubjectSwitcher
              subjects={subjects}
              activeSubjectId={activeSubjectId}
              currentSubject={currentSubject}
              onSelect={(id) => studyStore.selectSubject(id)}
              onAddSubject={(e) => {
                modalOrigin.capture(e);
                setOpenModal('add-subject');
              }}
            />

            {/* Hub navigation, inherited from the removed sidebar. Hidden on
                mobile, where the bottom bar takes over. */}
            <div className="hidden lg:flex items-center min-w-0">
              <div className="h-6 w-0.5 bg-slate-200 shrink-0 mr-3" />
              <HubTabs
                items={navItems}
                activeId={activeTab}
                animate={navAnimateRef.current}
                onSelect={(id) => handleTabChange(id as TabType, 'pointer')}
              />
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <StreakPill streak={streak} message={streakMessage} />

            {/* Discoverability for the palette: a shortcut nobody can see is
                not a feature. Reads as a search field, collapses to its icon
                once the header runs out of room. */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="btn-kinetic flex items-center gap-2 px-2 xl:pl-2.5 xl:pr-2 py-1.5 bg-[#FAF8F5] hover:bg-white text-slate-500 rounded-xl border-2 border-slate-900 shadow-neo-sm"
              aria-label="Search actions"
              title="Search actions"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden xl:inline text-[11px] font-bold">Search actions</span>
              <kbd className="hidden xl:inline text-[10px] font-mono font-black text-slate-600 border border-slate-300 rounded px-1 py-0.5 bg-white">
                {isMac ? '\u2318K' : 'Ctrl K'}
              </kbd>
            </button>

            {/* Dynamic Active AI Model Selector */}
            <div className="hidden md:block">
              <ModelPicker
                variant="compact"
                onOpenSettings={() => setOpenModal('api-key')}
              />
            </div>

            <button
              onClick={(e) => {
                modalOrigin.capture(e);
                setOpenModal('api-key');
              }}
              className="btn-kinetic p-1.5 text-slate-900 bg-white hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-neo-sm"
              title="AI providers and model settings"
              aria-label="AI providers and model settings"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="app-main flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF8F5] bg-neo-dots">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'notes' && (
              <NotesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'quizzes' && (
              <QuizzesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'exams' && <ExamsManager />}

            {activeTab === 'analytics' && (
              <Suspense fallback={<SkeletonAnalytics />}>
                <AnalyticsView />
              </Suspense>
            )}

            {activeTab === 'planner' && (
              <PlannerView onOpenPomodoro={() => setOpenModal('pomodoro')} />
            )}
          </div>
        </main>

        {/* Mobile navigation. The palette is unreachable without a hardware
            keyboard, so this is the only nav on touch and stays pinned. */}
        <HubBottomBar
          items={navItems}
          activeId={activeTab}
          onSelect={(id) => handleTabChange(id as TabType, 'pointer')}
        />
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {/* Modals and Side Drawers */}
      <ApiKeySettingsModal
        isOpen={openModal === 'api-key'}
        onClose={() => setOpenModal(null)}
        onSaved={() => {}}
        originRef={modalOrigin.ref}
      />

      <PomodoroTimer
        isOpen={openModal === 'pomodoro'}
        onClose={() => setOpenModal(null)}
      />

      <ExplainTermModal
        term={explainTermData?.term || ''}
        context={explainTermData?.context}
        onClose={() => setExplainTermData(null)}
        originRef={explainOrigin.ref}
      />

      {/* Add Subject Modal */}
      <Modal
        open={openModal === 'add-subject'}
        onClose={() => setOpenModal(null)}
        originRef={modalOrigin.ref}
        title="Add Course Subject"
        subtitle="Create a dedicated subject folder in Temari"
        icon={<FolderPlus className="w-5 h-5" />}
        iconClassName="bg-cyan-300 text-slate-950"
      >
        <form onSubmit={handleAddSubject} className="space-y-3.5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Subject / Course Name
            </label>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Amharic / Ethiopic Title (Optional)
            </label>
            <input
              type="text"
              value={newSubjectAmharicName}
              onChange={(e) => setNewSubjectAmharicName(e.target.value)}
              placeholder="e.g. ኦርጋኒክ ኬሚስትሪ"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold font-ethiopic focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Course Code (Optional)
            </label>
            <input
              type="text"
              value={newSubjectCode}
              onChange={(e) => setNewSubjectCode(e.target.value)}
              placeholder="e.g. CHEM201"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
            <button
              type="button"
              onClick={() => setOpenModal(null)}
              className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black text-slate-950 bg-yellow-300 hover:bg-yellow-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo active:translate-y-0.5"
            >
              Create Subject
            </button>
          </div>
        </form>

        {/* List of existing subjects with delete */}
        {subjects.length > 0 && (
          <div className="mt-5 pt-3 border-t-2 border-slate-200">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
              Existing Subjects
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {s.name} {s.code && `(${s.code})`}
                    </span>
                    {s.amharicName && (
                      <span className="text-xs font-bold text-slate-600 font-ethiopic border-l-2 border-slate-300 pl-2">
                        {s.amharicName}
                      </span>
                    )}
                  </div>
                  {subjects.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteSubject(s.id, e)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Subject */}
      <Modal
        open={confirmDeleteSubjectId !== null}
        onClose={() => setConfirmDeleteSubjectId(null)}
        title="Delete Subject"
        subtitle="This cannot be undone"
        icon={<Trash2 className="w-5 h-5" />}
        iconClassName="bg-rose-200 text-rose-950"
      >
        <p className="text-sm font-bold text-slate-700 mb-5">
          Delete{' '}
          <span className="text-slate-950">
            &ldquo;{subjects.find((s) => s.id === confirmDeleteSubjectId)?.name}&rdquo;
          </span>{' '}
          and all of its Notes, Quizzes, Exams and Study Tasks?
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
          <button
            type="button"
            onClick={() => setConfirmDeleteSubjectId(null)}
            className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteSubjectId) deleteSubject(confirmDeleteSubjectId);
              setConfirmDeleteSubjectId(null);
            }}
            className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl border-2 border-slate-900 transition-all shadow-neo active:translate-y-0.5"
          >
            Delete Subject
          </button>
        </div>
      </Modal>
    </div>
  );
}

