// Cliente das APIs REST do IUBI. Cada função mapeia para um endpoint dos
// serviços catalog / context / map-render / ogc.
import { SERVICES } from './config';
import { parseGeometry, toGeoJSON, type GeoJSONGeometry } from './geometry';
import type {
  AggregationPayload,
  AggregationResult,
  Connection,
  ContextSummary,
  ContextType,
  FeatureCollection,
  FormField,
  LayerCapability,
  LayerSchema,
  StatisticsCapabilities,
} from './types';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} em ${url}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

// ---- catalog ----
export function listConnections(): Promise<Connection[]> {
  return getJson<Connection[]>(`${SERVICES.catalog}/connections`);
}

export interface CatalogSearchResult {
  pagination: {
    currentPage: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
  };
  results: Array<Record<string, unknown>>;
}

export function searchCatalog(
  connectionId: string,
  params: { q?: string; limit?: number; offset?: number } = {},
): Promise<CatalogSearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  qs.set('limit', String(params.limit ?? 20));
  qs.set('offset', String(params.offset ?? 0));
  return getJson<CatalogSearchResult>(
    `${SERVICES.catalog}/${connectionId}/search?${qs.toString()}`,
  );
}

// ---- map-render (dados + renderização) ----
export function listLayerCapabilities(
  connectionId: string,
  service = 'WMS',
): Promise<LayerCapability[]> {
  return getJson<LayerCapability[]>(
    `${SERVICES.mapRender}/${connectionId}/data/capabilities?service=${service}`,
  );
}

export function getLayerSchema(
  connectionId: string,
  layer: string,
): Promise<LayerSchema> {
  return getJson<LayerSchema>(
    `${SERVICES.mapRender}/${connectionId}/data/features/${encodeURIComponent(layer)}/schema`,
  );
}

export function getStatisticsCapabilities(
  connectionId: string,
  layer: string,
): Promise<StatisticsCapabilities> {
  return getJson<StatisticsCapabilities>(
    `${SERVICES.mapRender}/${connectionId}/data/statistics/capabilities?layer=${encodeURIComponent(layer)}`,
  );
}

export function getStatistics(
  connectionId: string,
  layer: string,
  payload: AggregationPayload,
): Promise<AggregationResult> {
  return getJson<AggregationResult>(
    `${SERVICES.mapRender}/${connectionId}/data/layers/${encodeURIComponent(layer)}/statistics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export function getFeatures(
  connectionId: string,
  layer: string,
  params: { limit?: number; cqlFilter?: string; bbox?: string } = {},
): Promise<FeatureCollection> {
  const qs = new URLSearchParams({ layers: layer });
  qs.set('limit', String(params.limit ?? 100));
  if (params.cqlFilter) qs.set('cql_filter', params.cqlFilter);
  if (params.bbox) qs.set('bbox', params.bbox);
  return getJson<FeatureCollection>(
    `${SERVICES.mapRender}/${connectionId}/data/features?${qs.toString()}`,
  );
}

// URL da imagem (WMS GetMap) usada como camada no Leaflet.
export function renderMapBaseUrl(connectionId: string): string {
  return `${SERVICES.mapRender}/${connectionId}/render/map`;
}

export function legendUrl(connectionId: string, layer: string): string {
  return `${SERVICES.mapRender}/${connectionId}/render/legend?layer=${encodeURIComponent(layer)}`;
}

// ---- context ----
export function listContexts(type: ContextType, q?: string): Promise<ContextSummary[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return getJson<ContextSummary[]>(`${SERVICES.context}/contents/${type}${qs}`);
}

export interface ContextDetail extends ContextSummary {
  context?: unknown;
  favorite?: boolean;
}

export function getContext(type: ContextType, ctxId: string): Promise<ContextDetail> {
  return getJson<ContextDetail>(`${SERVICES.context}/contents/${type}/${ctxId}`);
}

// Prefixo usado na descrição para distinguir envios de formulário dos modelos.
export const FORM_SUBMISSION_TAG = '[envio]';

function geometryFieldName(fields: FormField[]): string | undefined {
  return fields.find((f) => f.type === 'point' || f.type === 'geometry')?.name;
}

// Extrai a geometria (GeoJSON) do campo geométrico do formulário, normalizando
// tanto o novo formato GeoJSON quanto o antigo texto "lat, lng".
function extractGeometry(
  values: Record<string, string>,
  fields: FormField[],
): { field?: string; geometry?: GeoJSONGeometry } {
  const field = geometryFieldName(fields);
  if (!field) return {};
  const parsed = parseGeometry(values[field] ?? '');
  if (!parsed) return { field };
  const geometry = toGeoJSON(parsed.kind, parsed.latlngs) ?? undefined;
  return { field, geometry };
}

function submissionBody(
  formId: string,
  formTitle: string,
  values: Record<string, string>,
  fields: FormField[],
  createdAt: string,
) {
  const nome = values.nome || Object.values(values)[0] || 'Sem nome';
  const when = new Date().toLocaleString('pt-BR');
  const { field, geometry } = extractGeometry(values, fields);
  return {
    title: `Envio: ${nome}`,
    description: `${FORM_SUBMISSION_TAG}:${formId} ${formTitle} · ${when}`,
    color: '#d97706',
    type: 'FORM' as const,
    context: { submission: true, formId, values, geometry, geometryField: field, createdAt },
  };
}

// Grava um envio de formulário como um contexto FORM no PostGIS do backend.
export function submitFormEntry(
  formId: string,
  formTitle: string,
  values: Record<string, string>,
  fields: FormField[],
): Promise<ContextDetail> {
  return getJson<ContextDetail>(`${SERVICES.context}/contents/FORM`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submissionBody(formId, formTitle, values, fields, new Date().toISOString())),
  });
}

// Atualiza um envio existente (CRUD — editar) mantendo a data de criação.
export function updateFormEntry(
  ctxId: string,
  formId: string,
  formTitle: string,
  values: Record<string, string>,
  fields: FormField[],
  createdAt: string,
): Promise<ContextDetail> {
  return getJson<ContextDetail>(`${SERVICES.context}/contents/FORM/${ctxId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submissionBody(formId, formTitle, values, fields, createdAt)),
  });
}

// Exclui um envio (CRUD — excluir).
export async function deleteContext(ctxId: string): Promise<void> {
  const res = await fetch(`${SERVICES.context}/contents/${ctxId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }
}
