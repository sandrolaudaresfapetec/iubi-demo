import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Send, User, Sparkles, AlertTriangle, Square } from 'lucide-react';
import { streamChat, getAiHealth, type ChatMessage } from '../lib/chat';
import { COPILOT_SYSTEM_PROMPT, COPILOT_SUGGESTIONS } from '../lib/copilotPrompt';
import { Markdown } from '../components/Markdown';
import { CodePlayground } from '../components/CodePlayground';

export function CopilotPage() {
  const ai = useQuery({ queryKey: ['ai-health'], queryFn: getAiHealth, retry: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playgroundCode, setPlaygroundCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    setInput('');

    const history: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: [{ role: 'system', content: COPILOT_SYSTEM_PROMPT }, ...history],
        model: ai.data?.model,
        signal: controller.signal,
        onToken: (token) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + token };
            return next;
          });
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err));
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const notConfigured = ai.data && !ai.data.aiConfigured;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 h-[calc(100vh-4rem-2.5rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-xl bg-iubi-600 text-white p-2">
          <Bot size={20} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 leading-tight">IUBI Copilot</h1>
          <p className="text-xs text-slate-400">
            Assistente de IA aberto · {ai.data?.model ?? 'Llama via Groq'}
          </p>
        </div>
      </div>

      {notConfigured && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            Assistente não configurado. Defina <code className="font-mono">GROQ_API_KEY</code> no
            arquivo <code className="font-mono">.env</code> e reinicie o servidor de API.
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <Sparkles className="text-iubi-300" size={40} />
            <p className="text-slate-500 max-w-md">
              Pergunte qualquer coisa sobre as APIs e componentes de geovisualização do IUBI. O
              assistente conhece os endpoints e gera exemplos de código — que você pode rodar no
              playground.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {COPILOT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={Boolean(notConfigured)}
                  className="text-left text-sm rounded-xl border border-slate-200 bg-white p-3 hover:border-iubi-300 hover:bg-iubi-50/50 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`shrink-0 rounded-lg p-1.5 h-fit ${
                m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-iubi-600 text-white'
              }`}
            >
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
                m.role === 'user'
                  ? 'bg-iubi-600 text-white'
                  : 'bg-white border border-slate-200'
              }`}
            >
              {m.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              ) : m.content ? (
                <Markdown text={m.content} onRunCode={setPlaygroundCode} />
              ) : (
                <span className="text-sm text-slate-400">…</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Pergunte sobre as APIs do IUBI…"
          disabled={Boolean(notConfigured)}
          className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm max-h-40 focus:outline-none focus:ring-2 focus:ring-iubi-300 disabled:bg-slate-50"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl bg-slate-200 text-slate-700 p-3 hover:bg-slate-300"
            title="Parar"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || Boolean(notConfigured)}
            className="rounded-xl bg-iubi-600 text-white p-3 hover:bg-iubi-700 disabled:opacity-40"
            title="Enviar"
          >
            <Send size={18} />
          </button>
        )}
      </form>

      {playgroundCode !== null && (
        <CodePlayground initialCode={playgroundCode} onClose={() => setPlaygroundCode(null)} />
      )}
    </div>
  );
}
