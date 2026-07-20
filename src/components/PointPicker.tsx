import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';

function parsePoint(value: string): [number, number] | null {
  const m = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lat, lng];
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Mini-mapa clicável: ao clicar, captura a coordenada (lat, lng) e a devolve
// como texto "lat, lng". Usa CircleMarker para não depender de assets de ícone.
export function PointPicker({
  value,
  onChange,
  height = 240,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
}) {
  const point = parsePoint(value);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer
        center={point ?? [-22.2, -48.7]}
        zoom={point ? 10 : 6}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={(lat, lng) => onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)} />
        {point && (
          <CircleMarker
            center={point}
            radius={8}
            pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.6, weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
