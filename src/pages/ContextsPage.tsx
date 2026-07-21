import { useState } from 'react';
import { LayoutDashboard, Search, Calendar, Tag, ExternalLink } from 'lucide-react';
import { useContexts } from '../lib/hooks';
import { FORM_SUBMISSION_TAG } from '../lib/iubi';
import { StateWrapper, Badge } from '../components/ui';
import type { ContextType } from '../lib/types';

const TYPES: ContextType[] = ['WEBMAP', 'DASHBOARD', 'FORM', 'REPORT', 'STORY_MAP'];

export function ContextsPage() {
  const [type, setType] = useState<ContextType>('WEBMAP');
  const [q, setQ] = useState('');
  const contexts = useContexts(type, q.trim() || undefined);

  // Abre o resultado do contexto em uma nova aba (tela cheia, sem corte).
  const openContext = (ctxType: ContextType, id: string) =>
    window.open(`/contexto/${ctxType}/${id}`, '_blank', 'noopener,noreferrer');
  // Esconde os envios de formulário (gravados como contextos FORM) da listagem.
  const items = (contexts.data ?? []).filter(
    (c) => !c.description?.startsWith(FORM_SUBMISSION_TAG),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <LayoutDashboard className="text-iubi-700" size={22} />
        <h1 className="text-2xl font-extrabold text-slate-800">Contextos</h1>
      </div>
      <p className="text-slate-500 mb-6 max-w-2xl">
        Contextos salvos no serviço <code className="font-mono text-iubi-700">/context</code> do
        IUBI — mapas, dashboards, formulários e relatórios criados na plataforma.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-iubi-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título…"
            className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-iubi-300"
          />
        </div>
      </div>

      <StateWrapper
        isLoading={contexts.isLoading}
        error={contexts.error}
        isEmpty={items.length === 0}
        loadingLabel="Carregando contextos…"
        emptyLabel={`Nenhum contexto do tipo ${type}.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openContext(c.type, c.id)}
              title="Abrir em nova aba"
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition-shadow hover:border-iubi-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-iubi-300"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: c.color || '#94a3b8' }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 truncate" title={c.title}>
                    {c.title || '(sem título)'}
                  </h3>
                  {c.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <ExternalLink size={15} className="mt-0.5 shrink-0 text-slate-300" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <Badge tone="blue">
                  <Tag size={10} className="inline mr-0.5" />
                  {c.type}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(c.lastModification).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <code className="mt-2 block font-mono text-[10px] text-slate-300 truncate">
                {c.id}
              </code>
            </button>
          ))}
        </div>
      </StateWrapper>
    </div>
  );
}
