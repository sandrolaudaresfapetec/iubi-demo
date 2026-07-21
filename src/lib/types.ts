// Tipos derivados dos OpenAPI dos serviços IUBI (catalog, context, map-render).

export type ConnectionType = 'CATALOG' | 'GIS_SERVER' | string;

export interface Connection {
  id: string;
  title: string;
  type: ConnectionType;
  provider: string;
  serviceUrl: string;
  httpUrl: string | null;
  discoveryUrl: string | null;
  ogcUrl: string | null;
  configJson?: Record<string, unknown>;
}

export interface BoundingBox {
  crs: string;
  // [[minLon, minLat], [maxLon, maxLat]]
  coords: [[number, number], [number, number]];
}

export interface LayerCapability {
  identifier: string;
  title: string;
  abstract: string;
  keywords: string[];
  boundingBox: BoundingBox | null;
  map: {
    type: string;
    connection_id: string;
    layers: string;
    url: string;
    style?: string;
  };
  featureInfo?: { connection_id: string; layers: string; url: string };
  legend?: { connection_id: string; layers: string; url: string };
}

export interface SchemaAttribute {
  name: string;
  type: string;
  localType: string;
  nillable: boolean;
  label: string;
}

export interface LayerSchema {
  resource_id: string;
  geometry_column: string;
  attributes: SchemaAttribute[];
}

export interface StatisticsCapabilities {
  functions: string[];
}

export interface AggregationItem {
  function: string;
  alias?: string;
}

export interface AggregationPayload {
  aggregationAttribute: string;
  aggregations: AggregationItem[];
  groupBy?: string[];
  cqlFilter?: string;
  bbox?: string;
}

export interface AggregationResult {
  message?: string;
  GroupByAttributes: string[];
  AggregationResults: Array<Array<number | string>>;
  AggregationFunctions: string[];
  AggregationAttribute: string;
}

export type ContextType = 'WEBMAP' | 'DASHBOARD' | 'FORM' | 'REPORT' | 'STORY_MAP';

export interface ContextSummary {
  id: string;
  title: string;
  description: string;
  color: string;
  type: ContextType;
  creation: string;
  lastModification: string;
  changedBy: string;
}

export interface WebmapLayerRef {
  connection: string;
  layer: string;
  title?: string;
  visible?: boolean;
  opacity?: number;
}

export interface WebmapContent {
  basemap?: string;
  center?: [number, number];
  zoom?: number;
  layers?: WebmapLayerRef[];
}

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface DashboardWidget {
  type: string;
  title?: string;
  chart?: string;
  connection?: string;
  layer?: string;
  cql?: string;
  value?: number | string;
  data?: ChartData;
}

export interface DashboardContent {
  layout?: string;
  center?: [number, number];
  zoom?: number;
  widgets?: DashboardWidget[];
}

export interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface FormContent {
  fields?: FormField[];
}

export interface ReportSection {
  title: string;
  type: string;
  text?: string;
  connection?: string;
  layer?: string;
  columns?: string[];
  rows?: string[][];
}

export interface ReportContent {
  center?: [number, number];
  zoom?: number;
  sections?: ReportSection[];
}

export interface StorySlide {
  title: string;
  text?: string;
  connection?: string;
  layer?: string;
  center?: [number, number];
  zoom?: number;
}

export interface StoryMapContent {
  slides?: StorySlide[];
}

export interface GeoFeature {
  type: 'Feature';
  id: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}
