import { GeometryPicker } from './GeometryPicker';
import { describeGeometry } from '../lib/geometry';
import type { FormField } from '../lib/types';

// Renderiza os campos de um formulário (texto, área, seleção e geometria),
// compartilhado entre o envio novo e a edição de um registro existente.
export function SubmissionFields({
  fields,
  values,
  onChange,
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (name: string, v: string) => void;
}) {
  return (
    <>
      {fields.map((f, i) => {
        const isGeom = f.type === 'point' || f.type === 'geometry';
        return (
          <div key={i}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.label}
              {f.required && <span className="ml-1 text-rose-500">*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                rows={2}
                required={f.required}
                value={values[f.name] ?? ''}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-700 focus:border-iubi-500 focus:outline-none"
              />
            ) : f.type === 'select' ? (
              <select
                required={f.required}
                value={values[f.name] ?? ''}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-700 focus:border-iubi-500 focus:outline-none"
              >
                <option value="">Selecione…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : isGeom ? (
              <div className="space-y-1.5">
                <GeometryPicker value={values[f.name] ?? ''} onChange={(v) => onChange(f.name, v)} />
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                  Geometria capturada: <span className="font-medium text-slate-700">{describeGeometry(values[f.name] ?? '')}</span>
                </div>
              </div>
            ) : (
              <input
                required={f.required}
                value={values[f.name] ?? ''}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-700 focus:border-iubi-500 focus:outline-none"
              />
            )}
          </div>
        );
      })}
    </>
  );
}
