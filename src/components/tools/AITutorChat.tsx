import React, { useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, X, Loader2, HelpCircle } from 'lucide-react';
import { useAiTutor } from '../../hooks/useAiTutor';

interface AITutorChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubjectName?: string;
  currentContext?: string;
}

export const AITutorChat: React.FC<AITutorChatProps> = ({
  isOpen,
  onClose,
  currentSubjectName,
  currentContext,
}) => {
  const { messages, input, loading, setInput, sendMessage } = useAiTutor(currentSubjectName);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendMessage(undefined, {
      subjectName: currentSubjectName,
      excerpt: currentContext,
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt, {
      subjectName: currentSubjectName,
      excerpt: currentContext,
    });
  };

  const quickPrompts = [
    'Give me a 3-question drill',
    'Explain the toughest concept simply',
    'How do I avoid common exam traps?',
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#FAF8F5] border-l-3 border-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="px-5 py-4 bg-yellow-300 text-slate-950 border-b-3 border-slate-900 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-950 text-yellow-300 rounded-xl font-black border-2 border-slate-900 shadow-neo-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider">
              ተማሪ AI Tutor <Sparkles className="w-4 h-4 text-cyan-800" />
            </h3>
            <p className="text-[11px] font-bold text-slate-800">
              {currentSubjectName ? `Subject: ${currentSubjectName}` : 'Interactive Study Assistant'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-950 hover:bg-slate-950 hover:text-white rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm active:translate-y-0.5"
          aria-label="Close tutor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F5F2EB]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl bg-yellow-300 border-2 border-slate-900 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-xs font-black">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed border-2 border-slate-900 ${
                m.role === 'user'
                  ? 'bg-yellow-300 text-slate-950 shadow-neo font-bold'
                  : 'bg-white text-slate-900 shadow-neo'
              }`}
            >
              <div className="whitespace-pre-line prose prose-xs max-w-none font-bold text-slate-900">{m.content}</div>
              <span className={`block text-[9px] mt-2 text-right font-black ${m.role === 'user' ? 'text-slate-800' : 'text-slate-500'}`}>
                {m.timestamp}
              </span>
            </div>
            {m.role === 'user' && (
              <div className="w-7 h-7 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0 mt-0.5 border-2 border-slate-900 shadow-xs">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2.5 text-slate-800 text-xs font-black p-3 bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm max-w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-800" />
            <span>ተማሪ Tutor is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="p-3 bg-white border-t-2 border-slate-900 shrink-0">
        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-700">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-800" /> Quick Prompts:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(q);
              }}
              className="text-[11px] font-black bg-[#FAF8F5] hover:bg-yellow-200 text-slate-900 px-2.5 py-1 rounded-lg border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t-2 border-slate-900 shrink-0 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask ተማሪ Tutor anything..."
          className="flex-1 px-3.5 py-2.5 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-400 font-bold placeholder-slate-500 shadow-neo-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
