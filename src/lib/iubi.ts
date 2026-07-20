// Cliente das APIs REST do IUBI. Cada função mapeia para um endpoint dos
// serviços catalog / context / map-render / ogc.
import { SERVICES } from './config';
import type {
  AggregationPayload,
  AggregationResult,
  Connection,
  ContextSummary,
  ContextType,
  FeatureCollection,
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
