import { useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon } from 'react-leaflet';
import { X, Pencil, Trash2, Eye, Loader2, CheckCircle2, Table as TableIcon } from 'lucide-react';
import { useContexts } from '../lib/hooks';
import {
  getContext,
  deleteContext,
  updateFormEntry,
  FORM_SUBMISSION_TAG,
  type ContextDetail,
} from '../lib/iubi';
import { SubmissionFields } from './SubmissionFields';
import { StateWrapper, Badge } from './ui';
import { describeGeometry, parseGeometry } from '../lib/geometry';
import type { ContextSummary, FormField } from '../lib/types';

interface Submission {
  id: string;
  values: Record<string, string>;
  geometryValue: string;
  createdAt: string;
  lastModification: string;
}

function submissionValues(detail: ContextDetail | undefined): Record<string, string> {
  const ctx = (detail?.context ?? {}) as Record<string, unknown>;
  const v = ctx.values;
  if (v && typeof v === 'object') {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = String(val ?? '');
    return out;
  }
  return {};
}

function GeometryPreview({ value, height = 220 }: { value: string; height?: number }) {
  const parsed = parseGeometry(value);
  if (!parsed) return <p className="text-xs text-slate-400">Sem geometria registrada.</p>;
  const { kind, latlngs } = parsed;
  const center = latlngs[0] ?? [-22.2, -48.7];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer center={center} zoom={latlngs.length ? 9 : 6} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {kind === 'LineString' && latlngs.length >= 2 && (
          <Polyline positions={latlngs} pathOptions={{ color: '#2563eb', weight: 3 }} />
        )}
        {kind === 'Polygon' && latlngs.length >= 3 && (
          <Polygon positions={latlngs} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, weight: 2 }} />
        )}
        {latlngs.map((p, i) => (
          <CircleMarker key={i} center={p} radius={6} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }} />
        ))}
      </MapContainer>
    </div>
  );
}

function EditDialog({
  form,
  fields,
  sub,
  onClose,
  onSaved,
}: {
  form: ContextSummary;
  fields: FormField[];
  sub: Submission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(sub.values);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const save = async () => {
    setStatus('saving');
    setErrorMsg(null);
    try {
      await updateFormEntry(sub.id, form.id, form.title, values, fields, sub.createdAt);
      onSaved();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Editar registro</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <SubmissionFields fields={fields} values={values} onChange={set} />
          {status === 'error' && <p className="text-sm text-rose-600">Falha ao salvar: {errorMsg}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={status === 'saving'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-iubi-600 px-3 py-2 text-sm font-semibold text-white hover:bg-iubi-700 disabled:opacity-60"
            >
              {status === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Card separado com a tabela de envios do formulário (persistidos no PostGIS)
// e CRUD: consultar, editar e excluir cada registro.
export function FormSubmissionsTable({
  form,
  fields,
  onClose,
}: {
  form: ContextSummary;
  fields: FormField[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listQuery = useContexts('FORM');
  const geomField = useMemo(() => fields.find((f) => f.type === 'point' || f.type === 'geometry'), [fields]);
  const textFields = useMemo(() => fields.filter((f) => f !== geomField), [fields, geomField]);

  const summaries = useMemo(() => {
    const tag = `${FORM_SUBMISSION_TAG}:${form.id}`;
    return (listQuery.data ?? [])
      .filter((c) => c.description?.startsWith(tag))
      .sort((a, b) => (a.lastModification < b.lastModification ? 1 : -1));
  }, [listQuery.data, form.id]);

  const detailQueries = useQueries({
    queries: summaries.map((s) => ({
      queryKey: ['context', 'FORM', s.id],
      queryFn: () => getContext('FORM', s.id),
    })),
  });

  const rows: Submission[] = summaries.map((s, i) => {
    const detail = detailQueries[i]?.data;
    const values = submissionValues(detail);
    return {
      id: s.id,
      values,
      geometryValue: geomField ? values[geomField.name] ?? '' : '',
      createdAt: (detail?.context as Record<string, unknown> | undefined)?.createdAt as string ?? s.creation,
      lastModification: s.lastModification,
    };
  });

  const [viewing, setViewing] = useState<Submission | null>(null);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['contexts', 'FORM'] });

  const onDelete = async (id: string) => {
    if (!window.confirm('Excluir este registro permanentemente?')) return;
    setDeletingId(id);
    try {
      await deleteContext(id);
      await refresh();
      qc.removeQueries({ queryKey: ['context', 'FORM', id] });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
            <TableIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">Tabela de testes de formulário</h2>
            <div className="text-xs text-slate-400">
              {form.title} · {rows.length} registro{rows.length === 1 ? '' : 's'} no PostGIS
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <StateWrapper
            isLoading={listQuery.isLoading}
            error={listQuery.error}
            isEmpty={rows.length === 0}
            loadingLabel="Carregando registros…"
            emptyLabel="Nenhum registro ainda — envie o formulário para criar um."
          >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  {textFields.map((f) => (
                    <th key={f.name} className="py-2 pr-4 font-medium">{f.label}</th>
                  ))}
                  {geomField && <th className="py-2 pr-4 font-medium">Geometria</th>}
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    {textFields.map((f) => (
                      <td key={f.name} className="py-2 pr-4 text-slate-700">{r.values[f.name] || '—'}</td>
                    ))}
                    {geomField && (
                      <td className="py-2 pr-4">
                        <Badge tone="blue">{describeGeometry(r.geometryValue)}</Badge>
                      </td>
                    )}
                    <td className="py-2 pr-4 text-xs text-slate-400">
                      {new Date(r.lastModification).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewing(r)}
                          title="Consultar"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setEditing(r)}
                          title="Editar"
                          className="rounded-lg p-1.5 text-iubi-600 hover:bg-iubi-50"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(r.id)}
                          disabled={deletingId === r.id}
                          title="Excluir"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                        >
                          {deletingId === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StateWrapper>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setViewing(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Registro</h3>
              <button onClick={() => setViewing(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <dl className="mb-3 space-y-1.5 text-sm">
              {textFields.map((f) => (
                <div key={f.name} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-slate-400">{f.label}</dt>
                  <dd className="text-slate-700">{viewing.values[f.name] || '—'}</dd>
                </div>
              ))}
              {geomField && (
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-slate-400">{geomField.label}</dt>
                  <dd className="text-slate-700">{describeGeometry(viewing.geometryValue)}</dd>
                </div>
              )}
            </dl>
            {geomField && <GeometryPreview value={viewing.geometryValue} />}
          </div>
        </div>
      )}

      {editing && (
        <EditDialog
          form={form}
          fields={fields}
          sub={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.removeQueries({ queryKey: ['context', 'FORM', editing.id] });
            refresh();
          }}
        />
      )}
    </div>
  );
}
