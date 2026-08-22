/**
 * HRHelpdeskChat.jsx - AI-Powered HR Q&A Chat Interface
 *
 * Allows employees to ask HR policy questions. The backend performs RAG
 * search against uploaded knowledge base documents and returns AI-generated
 * answers with citations. If the AI can't answer, the employee can escalate
 * to a human HR ticket.
 */
import { useState, useRef, useEffect } from 'react';
import api from '../services/api';

export default function HRHelpdeskChat({ onEscalate }) {
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: '👋 Hi! I\'m PaySphere HR Assistant. Ask me anything about company policies, leave rules, benefits, tax, or payroll. I\'ll search our knowledge base for answers.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setLastResult(null);

    try {
      const res = await api.post('/api/helpdesk/ask', { question });
      const { answer, citations, needsEscalation } = res.data;

      const systemMsg = {
        role: 'assistant',
        content: answer,
        citations,
        needsEscalation,
      };
      setMessages((prev) => [...prev, systemMsg]);
      setLastResult({ answer, citations, needsEscalation, originalQuery: question });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Sorry, I encountered an error processing your question. Please try again or escalate to HR.',
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleEscalate = async () => {
    if (!lastResult) return;
    try {
      await api.post('/api/helpdesk/tickets/escalate', {
        originalQuery: lastResult.originalQuery,
        aiResponse: lastResult.answer,
        priority: 'Medium',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: '✅ Your question has been escalated to an HR representative. You\'ll receive a response shortly.',
        },
      ]);
      setLastResult(null);
      onEscalate?.();
    } catch (err) {
      alert('Failed to escalate. Please try again.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const QUICK_QUESTIONS = [
    'What is the leave policy?',
    'How do I submit a tax proof?',
    'What are the working hours?',
    'How is overtime calculated?',
    'What benefits do I get?',
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
          🤖
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">HR Assistant</h3>
          <p className="text-blue-100 text-xs">Powered by AI · Knowledge Base</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-blue-100 text-xs">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : msg.role === 'system'
                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-bl-md border border-gray-200 dark:border-slate-700'
                    : msg.isError
                      ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded-bl-md border border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-md border border-gray-200 dark:border-slate-700'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Sources:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.citations.map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full"
                      >
                        📄 {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalation CTA */}
              {msg.needsEscalation && (
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-600">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                    I couldn't find a definitive answer. Would you like to escalate this to HR?
                  </p>
                  <button
                    onClick={handleEscalate}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition"
                  >
                    🎫 Escalate to HR
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Searching knowledge base...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions (only show at start) */}
      {messages.length <= 1 && (
        <div className="px-5 pb-2">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Try asking
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 transition border border-gray-200 dark:border-slate-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about policies, leave, benefits..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none max-h-24"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
