import { Fragment, type ReactNode } from 'react';
import { Play } from 'lucide-react';

const RUNNABLE_LANGS = new Set(['', 'js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript']);

// Renderizador minimalista de Markdown (blocos de código, inline code, listas,
// negrito e parágrafos). Suficiente para as respostas do Copilot, sem dependências.
export function Markdown({ text, onRunCode }: { text: string; onRunCode?: (code: string) => void }) {
  const blocks = text.split(/```/);
  return (
    <div className="prose-chat text-sm text-slate-700 leading-relaxed">
      {blocks.map((block, i) => {
        const isCode = i % 2 === 1;
        if (isCode) {
          const firstNewline = block.indexOf('\n');
          const lang = (firstNewline >= 0 ? block.slice(0, firstNewline) : '').trim().toLowerCase();
          const body = (firstNewline >= 0 ? block.slice(firstNewline + 1) : block).replace(/\n$/, '');
          const runnable = Boolean(onRunCode) && RUNNABLE_LANGS.has(lang) && body.trim().length > 0;
          return (
            <div key={i} className="relative">
              {runnable && (
                <button
                  type="button"
                  onClick={() => onRunCode!(body)}
                  className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-iubi-600 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-iubi-700"
                >
                  <Play size={11} /> Executar
                </button>
              )}
              <pre>
                <code>{body}</code>
              </pre>
            </div>
          );
        }
        return <Fragment key={i}>{renderInlineBlock(block)}</Fragment>;
      })}
    </div>
  );
}

function renderInlineBlock(text: string): ReactNode {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];

  const flushList = (key: string) => {
    if (list.length) {
      out.push(
        <ul key={key} className="list-disc pl-5 my-1 space-y-0.5">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet) {
      list.push(<li key={`li-${idx}`}>{renderInline(bullet[1])}</li>);
      return;
    }
    flushList(`ul-${idx}`);
    if (heading) {
      out.push(
        <p key={idx} className="font-semibold text-slate-800 mt-2">
          {renderInline(heading[1])}
        </p>,
      );
    } else if (line.trim() === '') {
      out.push(<div key={idx} className="h-2" />);
    } else {
      out.push(
        <p key={idx} className="my-0.5">
          {renderInline(line)}
        </p>,
      );
    }
  });
  flushList('ul-end');
  return <>{out}</>;
}

function renderInline(text: string): ReactNode {
  // divide por `code` e **negrito**
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
