import React, { useState } from 'react';
import { studyStore, useActiveSubject, useActiveSubjectId, useSubjects } from './hooks/useStudyStore';
import { NotesManager } from './components/notes/NotesManager';
import { QuizzesManager } from './components/quizzes/QuizzesManager';
import { ExamsManager } from './components/exams/ExamsManager';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { PlannerView } from './components/planner/PlannerView';
import { PomodoroTimer } from './components/tools/PomodoroTimer';
import { ExplainTermModal } from './components/tools/ExplainTermModal';
import { ApiKeySettingsModal } from './components/tools/ApiKeySettingsModal';
import { ModelPicker } from './components/tools/ModelPicker';
import { Modal } from './components/ui/Modal';
import {
  BookOpen,
  Layers,
  GraduationCap,
  TrendingUp,
  Calendar,
  Clock,
  Key,
  Plus,
  FolderPlus,
  Trash2,
  ChevronDown,
  X,
  Flame,
  Menu,
} from 'lucide-react';

type TabType = 'notes' | 'quizzes' | 'exams' | 'analytics' | 'planner';

/** Which app-level modal is open — one state instead of one boolean per modal. */
type OpenModal = 'api-key' | 'pomodoro' | 'add-subject' | null;

export default function App() {
  const subjects = useSubjects();
  const currentSubject = useActiveSubject();
  const activeSubjectId = useActiveSubjectId();
  const deleteSubject = studyStore.deleteSubject;

  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals and Drawers
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [explainTermData, setExplainTermData] = useState<{ term: string; context?: string } | null>(
    null
  );
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#2563eb');

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    // The store creates the subject and makes it the active subject.
    studyStore.addSubject({
      name: newSubjectName.trim(),
      code: newSubjectCode.trim() || undefined,
      color: newSubjectColor,
    });

    setNewSubjectName('');
    setNewSubjectCode('');
    setOpenModal(null);
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (subjects.length <= 1) {
      alert('You must have at least one active subject.');
      return;
    }
    if (confirm('Are you sure you want to delete this subject and all its related materials?')) {
      deleteSubject(id);
    }
  };

  const handleHighlightExplain = (term: string, context?: string) => {
    setExplainTermData({ term, context });
  };

  const navItems = [
    { id: 'notes', label: 'Interactive Notes', icon: BookOpen },
    { id: 'quizzes', label: 'Flashcard Quizzes', icon: Layers },
    { id: 'exams', label: 'Mock Exams', icon: GraduationCap },
    { id: 'analytics', label: 'Analytics & Progress', icon: TrendingUp },
    { id: 'planner', label: 'Study Planner', icon: Calendar },
  ];

  return (
    <div className="flex h-screen w-full bg-[#F1F5F9] text-slate-800 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (Neo-Brutalist Canvas) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-68 bg-[#FFFDF9] text-slate-900 flex flex-col h-full max-h-screen overflow-y-auto overscroll-contain p-4 border-r-3 border-slate-900 shadow-neo-lg lg:shadow-none transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-4 shrink-0">
          {/* Brand Header: Prominent TEMARI ተማሪ */}
          <div className="bg-[#FEF08A] border-3 border-slate-900 rounded-2xl p-3.5 shadow-neo relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-yellow-300 flex items-center justify-center font-black text-base shadow-neo-sm shrink-0 border-2 border-yellow-300">
                  ተ
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-black text-slate-950 tracking-tight leading-none">
                      TEMARI
                    </h1>
                    <span className="text-xs font-black px-1.5 py-0.5 bg-slate-900 text-yellow-300 rounded border border-slate-900">
                      ተማሪ
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-700 tracking-wide mt-0.5 uppercase">
                    AI Study Companion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 text-slate-900 hover:bg-yellow-300/80 rounded-lg border-2 border-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Course Card in Sidebar */}
          <div className="bg-white rounded-xl p-3 border-2 border-slate-900 shadow-neo-sm">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              <span>Active Subject</span>
              <button
                onClick={() => setOpenModal('add-subject')}
                className="px-2 py-0.5 bg-cyan-300 hover:bg-cyan-200 text-slate-900 rounded-md border border-slate-900 flex items-center gap-1 text-[10px] font-black shadow-xs transition-all active:translate-y-0.5"
                title="Add Subject"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
            <div className="relative">
              <select
                value={activeSubjectId ?? ''}
                onChange={(e) => studyStore.selectSubject(e.target.value)}
                className="w-full bg-[#FAF8F5] text-slate-900 text-xs font-black rounded-lg px-2.5 py-2 pr-7 border-2 border-slate-900 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-amber-400 appearance-none cursor-pointer"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-900 absolute right-2.5 top-2.5 pointer-events-none stroke-[2.5]" />
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5">
            <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Study Hub
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as TabType);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2 text-left ${
                    isActive
                      ? 'bg-[#67E8F9] text-slate-950 border-slate-900 shadow-neo translate-x-1'
                      : 'bg-white text-slate-800 border-slate-900/40 hover:border-slate-900 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  <div
                    className={`p-1 rounded-md border border-slate-900 shrink-0 ${
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick AI & Tools section */}
          <div className="space-y-1.5 pt-2 border-t-2 border-slate-200">
            <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Smart Utilities
            </div>
            <button
              onClick={() => {
                setOpenModal('pomodoro');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-amber-50 rounded-xl text-xs font-bold text-slate-900 border-2 border-slate-900 shadow-xs hover:shadow-neo-sm transition-all"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Focus Pomodoro</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-950 font-mono font-black rounded border border-slate-900">
                25m
              </span>
            </button>
            <button
              onClick={() => {
                setOpenModal('api-key');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-yellow-50 rounded-xl text-xs font-bold text-slate-900 border-2 border-slate-900 shadow-xs hover:shadow-neo-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <span>AI & Model Config</span>
              </div>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-yellow-200 border border-slate-900 rounded">
                BYOK
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Sidebar: Study Streak Widget */}
        <div className="pt-3 mt-auto border-t-2 border-slate-200 shrink-0">
          <div className="bg-[#FEF08A] rounded-xl p-3 border-2 border-slate-900 shadow-neo-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600 fill-amber-600" /> 5-Day Streak
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 bg-white text-slate-900 rounded border border-slate-900">
                85%
              </span>
            </div>
            <div className="w-full bg-white h-2.5 rounded-full border-2 border-slate-900 overflow-hidden mb-1.5">
              <div className="bg-emerald-400 h-full w-[85%]" />
            </div>
            <p className="text-[10px] font-bold text-slate-700 leading-tight">
              3 more sessions to reach weekly mastery goal.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content View Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b-3 border-slate-900 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-900 bg-yellow-300 rounded-lg border-2 border-slate-900 shadow-neo-sm active:translate-y-0.5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Subject Indicator Breadcrumb */}
            <div className="flex items-center gap-2 px-3 py-1 bg-[#FAF8F5] border-2 border-slate-900 rounded-xl shadow-neo-sm">
              <span
                className="w-3 h-3 rounded-full border border-slate-900"
                style={{ backgroundColor: currentSubject?.color || '#3B82F6' }}
              />
              <span className="text-xs font-black text-slate-950">
                {currentSubject?.name || 'General Studies'}
              </span>
              {currentSubject?.code && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 text-white font-mono font-bold rounded">
                  {currentSubject.code}
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dynamic Active AI Model Selector */}
            <ModelPicker
              variant="compact"
              onOpenSettings={() => setOpenModal('api-key')}
            />

            <button
              onClick={() => setOpenModal('api-key')}
              className="p-1.5 text-slate-900 bg-white hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
              title="AI Providers & Model Settings"
              aria-label="AI Providers and Models Settings"
            >
              <Key className="w-4 h-4" />
            </button>

            <div className="h-5 w-0.5 bg-slate-900 mx-0.5" />

            {/* User Profile Avatar with Ethiopian scholar badge */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-yellow-300 border-2 border-slate-900 flex items-center justify-center font-black text-xs shadow-neo-sm">
                ተማሪ
              </div>
              <span className="text-xs font-black text-slate-900 hidden md:block">
                Scholar
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF8F5] bg-neo-dots">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'notes' && (
              <NotesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'quizzes' && (
              <QuizzesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'exams' && <ExamsManager />}

            {activeTab === 'analytics' && <AnalyticsView />}

            {activeTab === 'planner' && (
              <PlannerView onOpenPomodoro={() => setOpenModal('pomodoro')} />
            )}
          </div>
        </main>
      </div>

      {/* Modals and Side Drawers */}
      <ApiKeySettingsModal
        isOpen={openModal === 'api-key'}
        onClose={() => setOpenModal(null)}
        onSaved={() => {}}
      />

      <PomodoroTimer
        isOpen={openModal === 'pomodoro'}
        onClose={() => setOpenModal(null)}
      />

      <ExplainTermModal
        term={explainTermData?.term || ''}
        context={explainTermData?.context}
        onClose={() => setExplainTermData(null)}
      />

      {/* Add Subject Modal */}
      <Modal
        open={openModal === 'add-subject'}
        onClose={() => setOpenModal(null)}
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
                  <span className="font-bold text-slate-900">
                    {s.name} {s.code && `(${s.code})`}
                  </span>
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
    </div>
  );
}

