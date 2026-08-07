// Utilitários de geometria para o formulário: conversão entre a representação
// do Leaflet (lat, lng) e GeoJSON (lng, lat), além de descrições legíveis.
export type GeomKind = 'Point' | 'LineString' | 'Polygon';

export interface GeoJSONGeometry {
  type: GeomKind;
  coordinates: number[] | number[][] | number[][][];
}

export const GEOM_LABEL: Record<GeomKind, string> = {
  Point: 'Ponto',
  LineString: 'Polilinha',
  Polygon: 'Polígono',
};

type LatLng = [number, number];

// Converte a lista de vértices (lat, lng) do mapa numa geometria GeoJSON válida.
// Retorna null enquanto ainda não houver vértices suficientes para o tipo.
export function toGeoJSON(kind: GeomKind, latlngs: LatLng[]): GeoJSONGeometry | null {
  const toLngLat = (p: LatLng): number[] => [p[1], p[0]];
  if (kind === 'Point') {
    if (latlngs.length < 1) return null;
    return { type: 'Point', coordinates: toLngLat(latlngs[0]) };
  }
  if (kind === 'LineString') {
    if (latlngs.length < 2) return null;
    return { type: 'LineString', coordinates: latlngs.map(toLngLat) };
  }
  if (latlngs.length < 3) return null;
  const ring = latlngs.map(toLngLat);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Lê um valor persistido e devolve o tipo + os vértices (lat, lng) para o mapa.
// Aceita GeoJSON (novo formato) e o texto "lat, lng" (formato antigo de ponto).
export function parseGeometry(value: string): { kind: GeomKind; latlngs: LatLng[] } | null {
  if (!value) return null;
  try {
    const g = JSON.parse(value) as GeoJSONGeometry;
    if (g && typeof g === 'object' && g.type) {
      if (g.type === 'Point') {
        const c = g.coordinates as number[];
        return { kind: 'Point', latlngs: [[c[1], c[0]]] };
      }
      if (g.type === 'LineString') {
        const c = g.coordinates as number[][];
        return { kind: 'LineString', latlngs: c.map((p) => [p[1], p[0]] as LatLng) };
      }
      if (g.type === 'Polygon') {
        const ring = (g.coordinates as number[][][])[0] ?? [];
        const pts = ring.map((p) => [p[1], p[0]] as LatLng);
        if (pts.length > 1) {
          const a = pts[0];
          const b = pts[pts.length - 1];
          if (a[0] === b[0] && a[1] === b[1]) pts.pop();
        }
        return { kind: 'Polygon', latlngs: pts };
      }
    }
  } catch {
    // não é JSON — tenta o formato textual "lat, lng"
  }
  const m = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { kind: 'Point', latlngs: [[lat, lng]] };
  }
  return null;
}

// Descrição curta para exibir em listas/tabelas (ex.: "Polígono · 4 vértices").
export function describeGeometry(value: string): string {
  const parsed = parseGeometry(value);
  if (!parsed) return '—';
  const { kind, latlngs } = parsed;
  if (kind === 'Point') {
    const p = latlngs[0];
    return `Ponto · ${p[0].toFixed(4)}, ${p[1].toFixed(4)}`;
  }
  return `${GEOM_LABEL[kind]} · ${latlngs.length} vértices`;
}

export function centroid(latlngs: LatLng[]): LatLng | null {
  if (latlngs.length === 0) return null;
  const sum = latlngs.reduce((a, p) => [a[0] + p[0], a[1] + p[1]] as LatLng, [0, 0] as LatLng);
  return [sum[0] / latlngs.length, sum[1] / latlngs.length];
}
