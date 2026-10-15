import React, { useState, useRef, useEffect } from 'react';
import { X, SendHorizonal, Sparkles, Bot } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Phase 13 — Floating AI Career Copilot (light theme, open-source aesthetic).
 * Talks to POST /api/v1/ai/copilot and renders the grounded reply.
 */
export const CopilotWidget: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: 'assistant',
      content: `Hi${user ? `, ${user.name.split(' ')[0]}` : ''}! I'm your CareerGraph copilot. Ask me about your profile, applications, match scores, or your next best action.`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming) return;

    const history: CopilotMessage[] = [...messages, { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const result = await api.copilotChat(history);
      setMessages([...history, { role: 'assistant', content: result.reply }]);
    } catch (err: any) {
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: `Sorry — I couldn't reach the AI service${err?.message ? ` (${err.message})` : ''}. Please try again.`,
        },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-3rem)] max-w-md h-[480px] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/25">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 leading-tight">AI Career Copilot</div>
                <div className="text-[10px] font-mono text-slate-500">z-ai/glm-5.3 · grounded on your graph</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close copilot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md border border-slate-200/60'
                  }`}
                >
                  {msg.content || '…'}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="bg-slate-100 border border-slate-200/60 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask about your career graph…"
                className="flex-1 resize-none px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
              />
              <button
                onClick={send}
                disabled={streaming || !input.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-500/25 disabled:opacity-40 hover:bg-sky-500 transition-all"
                aria-label="Send message"
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Launcher */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/30 hover:scale-105 transition-transform"
        aria-label="Toggle AI Copilot"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>
    </>
  );
};