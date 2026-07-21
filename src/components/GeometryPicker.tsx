import { useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  useMapEvents,
} from 'react-leaflet';
import { Undo2, Eraser, MapPin, Spline, Hexagon } from 'lucide-react';
import { GEOM_LABEL, parseGeometry, toGeoJSON, type GeomKind } from '../lib/geometry';

type LatLng = [number, number];

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const KIND_ICON: Record<GeomKind, typeof MapPin> = {
  Point: MapPin,
  LineString: Spline,
  Polygon: Hexagon,
};

// Mini-mapa para capturar geometria (ponto, polilinha ou polígono). O usuário
// escolhe o tipo e clica no mapa para adicionar vértices; o valor é devolvido
// como GeoJSON (string). Ponto = 1 clique; polilinha/polígono = vários cliques.
export function GeometryPicker({
  value,
  onChange,
  height = 260,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
}) {
  const parsed = useMemo(() => parseGeometry(value), [value]);
  const [kind, setKind] = useState<GeomKind>(parsed?.kind ?? 'Point');
  const [vertices, setVertices] = useState<LatLng[]>(parsed?.latlngs ?? []);

  const emit = (k: GeomKind, pts: LatLng[]) => {
    const geo = toGeoJSON(k, pts);
    onChange(geo ? JSON.stringify(geo) : '');
  };

  const changeKind = (k: GeomKind) => {
    setKind(k);
    const next = k === 'Point' ? vertices.slice(0, 1) : vertices;
    setVertices(next);
    emit(k, next);
  };

  const addVertex = (lat: number, lng: number) => {
    const p: LatLng = [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
    const next = kind === 'Point' ? [p] : [...vertices, p];
    setVertices(next);
    emit(kind, next);
  };

  const undo = () => {
    const next = vertices.slice(0, -1);
    setVertices(next);
    emit(kind, next);
  };

  const clear = () => {
    setVertices([]);
    emit(kind, []);
  };

  const center: LatLng = vertices[0] ?? [-22.2, -48.7];
  const positions = vertices;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['Point', 'LineString', 'Polygon'] as GeomKind[]).map((k) => {
          const Icon = KIND_ICON[k];
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => changeKind(k)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                active
                  ? 'border-iubi-500 bg-iubi-50 text-iubi-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon size={13} /> {GEOM_LABEL[k]}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={vertices.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <Undo2 size={13} /> Desfazer
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={vertices.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <Eraser size={13} /> Limpar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
        <MapContainer center={center} zoom={vertices.length ? 9 : 6} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onPick={addVertex} />
          {kind === 'LineString' && positions.length >= 2 && (
            <Polyline positions={positions} pathOptions={{ color: '#2563eb', weight: 3 }} />
          )}
          {kind === 'Polygon' && positions.length >= 3 && (
            <Polygon positions={positions} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.25, weight: 2 }} />
          )}
          {positions.map((p, i) => (
            <CircleMarker
              key={i}
              center={p}
              radius={6}
              pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }}
            />
          ))}
        </MapContainer>
      </div>

      <p className="text-xs text-slate-400">
        {kind === 'Point'
          ? 'Clique no mapa para marcar o ponto.'
          : `Clique no mapa para adicionar vértices ${kind === 'Polygon' ? 'do polígono' : 'da polilinha'}.`}{' '}
        {vertices.length > 0 && <span className="text-slate-500">({vertices.length} vértice{vertices.length > 1 ? 's' : ''})</span>}
      </p>
    </div>
  );
}
