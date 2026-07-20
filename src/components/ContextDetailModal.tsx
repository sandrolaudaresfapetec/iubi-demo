import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Map as MapIcon, LayoutDashboard, FileText, ClipboardList, BookOpen, Layers } from 'lucide-react';
import { useContext } from '../lib/hooks';
import { StateWrapper, Badge } from './ui';
import type {
  ContextSummary,
  DashboardContent,
  FormContent,
  ReportContent,
  StoryMapContent,
  WebmapContent,
} from '../lib/types';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const TYPE_META = {
  WEBMAP: { icon: MapIcon, label: 'Mapa interativo' },
  DASHBOARD: { icon: LayoutDashboard, label: 'Painel' },
  FORM: { icon: ClipboardList, label: 'Formulário' },
  REPORT: { icon: FileText, label: 'Relatório' },
  STORY_MAP: { icon: BookOpen, label: 'Story map' },
} as const;

function WebmapView({ content }: { content: WebmapContent }) {
  const layers = content.layers ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Este mapa abre com {layers.length} camada(s). Cada camada vem de uma fonte pública e aparece
        colorida sobre o mapa.
      </p>
      <ul className="space-y-2">
        {layers.map((l, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Layers size={16} className="mt-0.5 shrink-0 text-iubi-600" />
            <div className="min-w-0">
              <div className="font-medium text-slate-800">{l.title || l.layer}</div>
              <div className="text-xs text-slate-400">Fonte: {l.connection}</div>
            </div>
            <Badge tone={l.visible ? 'green' : 'slate'}>{l.visible ? 'Visível' : 'Oculta'}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardView({ content }: { content: DashboardContent }) {
  const widgets = content.widgets ?? [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {widgets.map((w, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <Badge tone="blue">{w.type}</Badge>
          <div className="mt-1 font-medium text-slate-800">{w.title || '(sem título)'}</div>
          {w.value !== undefined && <div className="text-2xl font-extrabold text-iubi-700">{w.value}</div>}
          {w.chart && <div className="text-xs text-slate-400">Gráfico: {w.chart}</div>}
          {w.layer && <div className="text-xs text-slate-400">Camada: {w.layer}</div>}
        </div>
      ))}
    </div>
  );
}

function FormView({ content }: { content: FormContent }) {
  const fields = content.fields ?? [];
  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={i}>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {f.label}
            {f.required && <span className="ml-1 text-rose-500">*</span>}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              disabled
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-400"
            />
          ) : f.type === 'select' ? (
            <select disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-400">
              {(f.options ?? []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              disabled
              placeholder={f.type}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-400"
            />
          )}
        </div>
      ))}
      <p className="text-xs text-slate-400">Pré-visualização do formulário (somente leitura no demo).</p>
    </div>
  );
}

function ReportView({ content }: { content: ReportContent }) {
  const sections = content.sections ?? [];
  return (
    <ol className="space-y-2">
      {sections.map((s, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-iubi-100 text-xs font-bold text-iubi-700">
            {i + 1}
          </span>
          <div>
            <div className="font-medium text-slate-800">{s.title}</div>
            <div className="text-xs text-slate-400">
              {s.type}
              {s.layer ? ` · ${s.layer}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StoryMapView({ content }: { content: StoryMapContent }) {
  const slides = content.slides ?? [];
  return (
    <div className="space-y-3">
      {slides.map((s, i) => (
        <div key={i} className="rounded-xl border-l-4 border-iubi-500 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-iubi-600">Capítulo {i + 1}</div>
          <div className="font-semibold text-slate-800">{s.title}</div>
          {s.text && <p className="mt-1 text-sm text-slate-500">{s.text}</p>}
          {s.layer && <div className="mt-1 text-xs text-slate-400">Camada: {s.layer}</div>}
        </div>
      ))}
    </div>
  );
}

function ContentView({ type, content }: { type: ContextSummary['type']; content: unknown }) {
  const rec = asRecord(content);
  switch (type) {
    case 'WEBMAP':
      return (
        <WebmapView
          content={{
            basemap: str(rec.basemap),
            layers: asArray(rec.layers).map((l) => ({
              connection: str(l.connection) ?? '',
              layer: str(l.layer) ?? '',
              title: str(l.title),
              visible: l.visible === true,
              opacity: typeof l.opacity === 'number' ? l.opacity : undefined,
            })),
          }}
        />
      );
    case 'DASHBOARD':
      return (
        <DashboardView
          content={{
            widgets: asArray(rec.widgets).map((w) => ({
              type: str(w.type) ?? 'widget',
              title: str(w.title),
              chart: str(w.chart),
              layer: str(w.layer),
              value: typeof w.value === 'number' || typeof w.value === 'string' ? w.value : undefined,
            })),
          }}
        />
      );
    case 'FORM':
      return (
        <FormView
          content={{
            fields: asArray(rec.fields).map((f) => ({
              name: str(f.name) ?? '',
              label: str(f.label) ?? str(f.name) ?? '',
              type: str(f.type) ?? 'text',
              required: f.required === true,
              options: Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === 'string') : undefined,
            })),
          }}
        />
      );
    case 'REPORT':
      return (
        <ReportView
          content={{
            sections: asArray(rec.sections).map((s) => ({
              title: str(s.title) ?? '',
              type: str(s.type) ?? '',
              layer: str(s.layer),
            })),
          }}
        />
      );
    case 'STORY_MAP':
      return (
        <StoryMapView
          content={{
            slides: asArray(rec.slides).map((s) => ({
              title: str(s.title) ?? '',
              text: str(s.text),
              layer: str(s.layer),
            })),
          }}
        />
      );
    default:
      return null;
  }
}

export function ContextDetailModal({ summary, onClose }: { summary: ContextSummary; onClose: () => void }) {
  const detail = useContext(summary.type, summary.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta = TYPE_META[summary.type];
  const Icon = meta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: summary.color || '#2563eb' }}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">{summary.title}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <Badge tone="blue">{meta.label}</Badge>
              <span>{new Date(summary.lastModification).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {summary.description && <p className="text-sm text-slate-600">{summary.description}</p>}
          <StateWrapper
            isLoading={detail.isLoading}
            error={detail.error}
            isEmpty={!detail.data}
            loadingLabel="Carregando contexto…"
            emptyLabel="Sem conteúdo para exibir."
          >
            <ContentView type={summary.type} content={detail.data?.context} />
          </StateWrapper>

          {summary.type === 'WEBMAP' && (
            <Link
              to="/mapa"
              className="inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-2 text-sm font-semibold text-white hover:bg-iubi-700"
            >
              <MapIcon size={15} /> Abrir no Explorador de Mapa
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
