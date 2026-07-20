import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
      {onFeatureInfo && <ClickInspector layers={layers} onResult={onFeatureInfo} />}
    </MapContainer>
  );
}
