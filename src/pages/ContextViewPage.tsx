import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { useContext } from '../lib/hooks';
import { ContentView, TYPE_META } from '../components/ContextDetailModal';
import { StateWrapper, Badge } from '../components/ui';
import type { ContextSummary, ContextType } from '../lib/types';

const TYPES: ContextType[] = ['WEBMAP', 'DASHBOARD', 'FORM', 'REPORT', 'STORY_MAP'];

// Página em tela cheia para exibir o resultado de um contexto (aberta em nova
// aba a partir dos cards), evitando o corte do modal.
export function ContextViewPage() {
  const { type: rawType, id } = useParams<{ type: string; id: string }>();
  const type = (TYPES.includes(rawType as ContextType) ? rawType : 'WEBMAP') as ContextType;
  const detail = useContext(type, id);
  const data = detail.data;

  useEffect(() => {
    if (data?.title) document.title = `${data.title} — IUBI Demo`;
  }, [data?.title]);

  const summary: ContextSummary | null = data ?? null;

  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/iubi-logo.png" alt="IUBI" className="h-7" />
          </Link>
          <span className="ml-1 flex items-center gap-2 text-sm text-slate-500">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
              style={{ background: summary?.color || '#2563eb' }}
            >
              <Icon size={15} />
            </span>
            <Badge tone="blue">{meta.label}</Badge>
          </span>
          <Link
            to="/contextos"
            className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ← Voltar aos contextos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <StateWrapper
          isLoading={detail.isLoading}
          error={detail.error}
          isEmpty={!data}
          loadingLabel="Carregando contexto…"
          emptyLabel="Contexto não encontrado."
        >
          {summary && (
            <>
              <h1 className="text-2xl font-extrabold text-slate-800">{summary.title}</h1>
              {summary.description && (
                <p className="mt-1 mb-4 max-w-3xl text-sm text-slate-600">{summary.description}</p>
              )}
              <ContentView summary={summary} content={data?.context} />
              {summary.type === 'WEBMAP' && (
                <Link
                  to="/mapa"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-2 text-sm font-semibold text-white hover:bg-iubi-700"
                >
                  <MapIcon size={15} /> Abrir no Explorador de Mapa
                </Link>
              )}
            </>
          )}
        </StateWrapper>
      </main>
    </div>
  );
}
