import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  LayersControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { Search as SearchIcon } from 'lucide-react';
import { renderMapBaseUrl } from '../lib/iubi';
import { SERVICES } from '../lib/config';
import type { LayerCapability } from '../lib/types';

// Corrige os ícones padrão do Leaflet no bundler.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface ActiveLayer {
  connectionId: string;
  layer: LayerCapability;
}

export interface FeatureInfoResult {
  latlng: L.LatLng;
  point: L.Point;
  data: unknown;
  loading: boolean;
  error?: string;
}

function FitBounds({ layers }: { layers: ActiveLayer[] }) {
  const map = useMap();
  useEffect(() => {
    const withBounds = layers.filter((l) => l.layer.boundingBox);
    if (withBounds.length === 0) return;
    let bounds: L.LatLngBounds | null = null;
    for (const { layer } of withBounds) {
      const bb = layer.boundingBox!;
      // coords: [[minLon,minLat],[maxLon,maxLat]] (algumas conexões invertem)
      const [a, b] = bb.coords;
      const lb = L.latLngBounds(
        L.latLng(Math.min(a[1], b[1]), Math.min(a[0], b[0])),
        L.latLng(Math.max(a[1], b[1]), Math.max(a[0], b[0])),
      );
      bounds = bounds ? bounds.extend(lb) : lb;
    }
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [layers, map]);
  return null;
}

function ClickInspector({
  layers,
  onResult,
}: {
  layers: ActiveLayer[];
  onResult: (r: FeatureInfoResult | null) => void;
}) {
  const map = useMapEvents({
    async click(e) {
      if (layers.length === 0) return;
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);
      const bounds = map.getBounds();
      const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
      const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
      const bbox = `${sw.x},${sw.y},${ne.x},${ne.y}`;
      const layerNames = layers.map((l) => l.layer.map.layers).join(',');
      const connId = layers[layers.length - 1].connectionId;

      onResult({ latlng: e.latlng, point, data: null, loading: true });

      const qs = new URLSearchParams({
        layers: layerNames,
        bbox,
        crs: 'EPSG:3857',
        width: String(size.x),
        height: String(size.y),
        x: String(Math.round(point.x)),
        y: String(Math.round(point.y)),
      });
      try {
        const res = await fetch(
          `${SERVICES.mapRender}/${connId}/render/feature-info?${qs.toString()}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        onResult({ latlng: e.latlng, point, data, loading: false });
      } catch (err) {
        onResult({
          latlng: e.latlng,
          point,
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
  return null;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

function AddressSearch() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=pt-BR&q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? (data as GeocodeResult[]) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    map.flyTo([lat, lon], 15);
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lon]).addTo(map).bindPopup(r.display_name).openPopup();
    setOpen(false);
    setResults([]);
    setQuery(r.display_name);
  };

  return (
    <div
      ref={boxRef}
      className="absolute left-1/2 top-3 z-[1000] w-80 -translate-x-1/2"
    >
      <form onSubmit={search} className="flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-lg ring-1 ring-slate-200 backdrop-blur">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar endereço no mapa…"
          className="flex-1 rounded-lg bg-transparent px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-iubi-600 text-white hover:bg-iubi-700"
          aria-label="Buscar"
        >
          <SearchIcon size={15} />
        </button>
      </form>
      {open && (loading || results.length > 0) && (
        <ul className="mt-1 max-h-60 overflow-y-auto rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
          {loading && <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>}
          {!loading &&
            results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">Nenhum resultado.</li>
          )}
        </ul>
      )}
    </div>
  );
}

interface MapViewProps {
  layers: ActiveLayer[];
  onFeatureInfo?: (r: FeatureInfoResult | null) => void;
}

export function MapView({ layers, onFeatureInfo }: MapViewProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  return (
    <MapContainer center={[-15, -51]} zoom={4} className="h-full w-full">
      <LayersControl position="bottomright">
        <LayersControl.BaseLayer checked name="Mapa (OSM)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satélite">
          <TileLayer
            attribution='Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Topográfico">
          <TileLayer
            attribution='Tiles &copy; <a href="https://www.esri.com">Esri</a> — Sources: Esri, USGS, NOAA'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {layers.map(({ connectionId, layer }) => (
        <WMSTileLayer
          key={`${connectionId}:${layer.map.layers}`}
          url={renderMapBaseUrl(connectionId)}
          layers={layer.map.layers}
          format="image/png"
          transparent
          version="1.3.0"
          opacity={0.8}
        />
      ))}
      <FitBounds layers={layers} />
      <AddressSearch />
      {onFeatureInfo && <ClickInspector layers={layers} onResult={onFeatureInfo} />}
    </MapContainer>
  );
}
