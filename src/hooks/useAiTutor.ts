import { useState, useCallback } from 'react';
import { ChatMessage } from '../types';
import { AIService } from '../services/aiService';

export interface UseAiTutorReturn {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  setInput: (value: string) => void;
  sendMessage: (customText?: string, context?: { subjectName?: string; excerpt?: string }) => Promise<void>;
  clearHistory: () => void;
}

/**
 * Deep hook encapsulating the AI Tutor chat lifecycle and context injection.
 */
export function useAiTutor(initialSubjectName?: string): UseAiTutorReturn {
  const getWelcomeMessage = (subjectName?: string): ChatMessage => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hello! I'm your **ተማሪ (Temari) AI Tutor**. ${
      subjectName ? `We're currently focusing on **${subjectName}**.` : 'How can I assist your study session today?'
    }\n\nFeel free to ask for step-by-step explanations, practice problems, or concept simplifications!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage(initialSubjectName)]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const sendMessage = useCallback(
    async (customText?: string, context?: { subjectName?: string; excerpt?: string }) => {
      const text = (customText || input).trim();
      if (!text || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      if (!customText) setInput('');
      setLoading(true);

      try {
        const promptContext = `Subject: ${context?.subjectName || initialSubjectName || 'General Study'}\n${
          context?.excerpt ? `Notes excerpt: ${context.excerpt.slice(0, 1000)}` : ''
        }`;

        const reply = await AIService.chatTutor(
          nextMessages.map((m) => ({ role: m.role, content: m.content })),
          promptContext
        );

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${err?.message || 'Please verify your network connection or API settings.'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, initialSubjectName]
  );

  const clearHistory = useCallback(() => {
    setMessages([getWelcomeMessage(initialSubjectName)]);
  }, [initialSubjectName]);

  return {
    messages,
    input,
    loading,
    setInput,
    sendMessage,
    clearHistory,
  };
}
