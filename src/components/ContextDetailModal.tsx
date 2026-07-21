import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  X,
  Map as MapIcon,
  LayoutDashboard,
  FileText,
  ClipboardList,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Table as TableIcon,
} from 'lucide-react';
import { useContext, useContexts } from '../lib/hooks';
import { submitFormEntry, FORM_SUBMISSION_TAG } from '../lib/iubi';
import { ContextMap } from './ContextMap';
import { SubmissionFields } from './SubmissionFields';
import { FormSubmissionsTable } from './FormSubmissionsTable';
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

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function center2(value: unknown): [number, number] | undefined {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value[0], value[1]];
  }
  return undefined;
}

export const TYPE_META = {
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
      <ContextMap
        layers={layers.map((l) => ({
          connection: l.connection,
          layer: l.layer,
          visible: l.visible,
          opacity: l.opacity,
        }))}
        center={content.center}
        zoom={content.zoom}
        height={320}
      />
      <ul className="space-y-2">
        {layers.map((l, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Layers size={16} className="mt-0.5 shrink-0 text-iubi-600" />
            <div className="min-w-0 flex-1">
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

function ChartWidget({ data, title }: { data?: { labels: string[]; values: number[] }; title?: string }) {
  if (!data || data.labels.length === 0) {
    return <div className="text-xs text-slate-400">Sem dados para o gráfico.</div>;
  }
  const rows = data.labels.map((label, i) => ({ label, value: data.values[i] ?? 0 }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" name={title || 'Valor'} fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DashboardView({ content }: { content: DashboardContent }) {
  const widgets = content.widgets ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {widgets.map((w, i) => {
        const span = w.type === 'map' || w.type === 'chart' ? 'sm:col-span-2' : '';
        return (
          <div key={i} className={`rounded-xl border border-slate-200 bg-white p-3 ${span}`}>
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="blue">{w.type}</Badge>
              <span className="font-medium text-slate-800">{w.title || '(sem título)'}</span>
            </div>
            {w.type === 'kpi' && w.value !== undefined && (
              <div className="text-3xl font-extrabold text-iubi-700">
                {typeof w.value === 'number' ? w.value.toLocaleString('pt-BR') : w.value}
              </div>
            )}
            {w.type === 'chart' && <ChartWidget data={w.data} title={w.title} />}
            {w.type === 'map' && (
              <ContextMap
                layers={[{ connection: w.connection, layer: w.layer ?? '', cql: w.cql }]}
                center={content.center}
                zoom={content.zoom}
                height={260}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormView({ summary, content }: { summary: ContextSummary; content: FormContent }) {
  const fields = content.fields ?? [];
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const submissionsQuery = useContexts('FORM');
  const submissions = useMemo(() => {
    const tag = `${FORM_SUBMISSION_TAG}:${summary.id}`;
    return (submissionsQuery.data ?? []).filter((c) => c.description?.startsWith(tag));
  }, [submissionsQuery.data, summary.id]);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingGeom = fields.find(
      (f) => (f.type === 'point' || f.type === 'geometry') && f.required && !(values[f.name] ?? '').trim(),
    );
    if (missingGeom) {
      setStatus('error');
      setErrorMsg(`Marque a geometria no mapa (campo "${missingGeom.label}").`);
      return;
    }
    setStatus('saving');
    setErrorMsg(null);
    try {
      await submitFormEntry(summary.id, summary.title, values, fields);
      setStatus('done');
      setValues({});
      setFormKey((k) => k + 1);
      await qc.invalidateQueries({ queryKey: ['contexts', 'FORM'] });
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <form className="space-y-3" onSubmit={onSubmit}>
        <SubmissionFields key={formKey} fields={fields} values={values} onChange={set} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-2 text-sm font-semibold text-white hover:bg-iubi-700 disabled:opacity-60"
          >
            {status === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Enviar (grava no PostGIS)
          </button>
          <button
            type="button"
            onClick={() => setShowTable(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <TableIcon size={15} /> Tabela de testes ({submissions.length})
          </button>
          {status === 'done' && <span className="text-sm text-emerald-600">Registro salvo no PostGIS.</span>}
          {status === 'error' && <span className="text-sm text-rose-600">Falha ao salvar: {errorMsg}</span>}
        </div>
      </form>

      {showTable && (
        <FormSubmissionsTable form={summary} fields={fields} onClose={() => setShowTable(false)} />
      )}
    </>
  );
}

function ReportView({ content }: { content: ReportContent }) {
  const sections = content.sections ?? [];
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <section key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-iubi-100 text-xs font-bold text-iubi-700">
              {i + 1}
            </span>
            <h3 className="font-semibold text-slate-800">{s.title}</h3>
          </div>
          {s.type === 'text' && s.text && <p className="text-sm text-slate-600">{s.text}</p>}
          {s.type === 'map' && (
            <ContextMap
              layers={[{ connection: s.connection, layer: s.layer ?? '' }]}
              center={content.center}
              zoom={content.zoom}
              height={240}
            />
          )}
          {s.type === 'table' && s.columns && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    {s.columns.map((c) => (
                      <th key={c} className="py-1.5 pr-4 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(s.rows ?? []).map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100">
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-1.5 pr-4 text-slate-700">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function StoryMapView({ content }: { content: StoryMapContent }) {
  const slides = content.slides ?? [];
  const [idx, setIdx] = useState(0);
  if (slides.length === 0) return null;
  const s = slides[Math.min(idx, slides.length - 1)];
  return (
    <div className="space-y-3">
      <ContextMap
        mapKey={idx}
        layers={[{ connection: s.connection, layer: s.layer ?? '' }]}
        center={s.center}
        zoom={s.zoom}
        height={300}
      />
      <div className="rounded-xl border-l-4 border-iubi-500 bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-iubi-600">
          Capítulo {idx + 1} de {slides.length}
        </div>
        <div className="font-semibold text-slate-800">{s.title}</div>
        {s.text && <p className="mt-1 text-sm text-slate-500">{s.text}</p>}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Anterior
        </button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i === idx ? 'bg-iubi-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIdx((v) => Math.min(slides.length - 1, v + 1))}
          disabled={idx === slides.length - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Próximo <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function ContentView({
  summary,
  content,
}: {
  summary: ContextSummary;
  content: unknown;
}) {
  const rec = asRecord(content);
  switch (summary.type) {
    case 'WEBMAP':
      return (
        <WebmapView
          content={{
            basemap: str(rec.basemap),
            center: center2(rec.center),
            zoom: num(rec.zoom),
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
            center: center2(rec.center),
            zoom: num(rec.zoom),
            widgets: asArray(rec.widgets).map((w) => {
              const d = asRecord(w.data);
              const labels = Array.isArray(d.labels)
                ? d.labels.filter((x): x is string => typeof x === 'string')
                : [];
              const vals = Array.isArray(d.values)
                ? d.values.filter((x): x is number => typeof x === 'number')
                : [];
              return {
                type: str(w.type) ?? 'widget',
                title: str(w.title),
                chart: str(w.chart),
                connection: str(w.connection),
                layer: str(w.layer),
                cql: str(w.cql),
                value: typeof w.value === 'number' || typeof w.value === 'string' ? w.value : undefined,
                data: labels.length ? { labels, values: vals } : undefined,
              };
            }),
          }}
        />
      );
    case 'FORM':
      return (
        <FormView
          summary={summary}
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
            center: center2(rec.center),
            zoom: num(rec.zoom),
            sections: asArray(rec.sections).map((s) => ({
              title: str(s.title) ?? '',
              type: str(s.type) ?? '',
              text: str(s.text),
              connection: str(s.connection),
              layer: str(s.layer),
              columns: Array.isArray(s.columns)
                ? s.columns.filter((c): c is string => typeof c === 'string')
                : undefined,
              rows: Array.isArray(s.rows)
                ? s.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : []))
                : undefined,
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
              connection: str(s.connection),
              layer: str(s.layer),
              center: center2(s.center),
              zoom: num(s.zoom),
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
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white p-4">
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
            <ContentView summary={summary} content={detail.data?.context} />
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
