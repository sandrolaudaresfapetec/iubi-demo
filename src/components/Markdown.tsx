import { Fragment, type ReactNode } from 'react';
import { FileCode } from 'lucide-react';

// Extrai um rótulo de nome de arquivo do cabeçalho da cerca (ex.: "html file=index.html").
function fileLabel(info: string): string | null {
  const kv = info.match(/(?:file|name|title)=([^\s]+)/i);
  if (kv) return kv[1].replace(/^["']|["']$/g, '');
  const colon = info.match(/^[a-z]+:([^\s]+\.[a-z0-9]+)$/i);
  if (colon) return colon[1];
  const bare = info.match(/(^|\s)([^\s]+\.[a-z0-9]+)(\s|$)/i);
  return bare ? bare[2] : null;
}

// Renderizador minimalista de Markdown (blocos de código, inline code, listas,
// negrito e parágrafos). Suficiente para as respostas do Copilot, sem dependências.
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="prose-chat text-sm text-slate-700 leading-relaxed">
      {blocks.map((block, i) => {
        const isCode = i % 2 === 1;
        if (isCode) {
          const firstNewline = block.indexOf('\n');
          const info = (firstNewline >= 0 ? block.slice(0, firstNewline) : '').trim();
          const body = (firstNewline >= 0 ? block.slice(firstNewline + 1) : block).replace(/\n$/, '');
          const label = fileLabel(info);
          return (
            <div key={i} className="my-2 overflow-hidden rounded-lg border border-slate-200">
              {label && (
                <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  <FileCode size={12} /> {label}
                </div>
              )}
              <pre className="!my-0 !rounded-none !border-0">
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
