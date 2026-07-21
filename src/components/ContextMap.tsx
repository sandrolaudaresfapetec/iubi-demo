import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet';
import type { WMSParams } from 'leaflet';
import { renderMapBaseUrl, legendUrl } from '../lib/iubi';
import { useConnections } from '../lib/hooks';

export interface ContextMapLayer {
  connection?: string;
  layer: string;
  visible?: boolean;
  opacity?: number;
  cql?: string;
}

interface WmsParamsWithCql extends WMSParams {
  cql_filter?: string;
}

interface ContextMapProps {
  layers: ContextMapLayer[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  mapKey?: string | number;
}

// Mapa Leaflet funcional para os contextos: resolve o título da conexão para o
// id (via /catalog/connections) e desenha as camadas WMS reais sobre o OSM.
export function ContextMap({ layers, center, zoom, height = 280, mapKey }: ContextMapProps) {
  const { data: connections, isLoading } = useConnections();

  const resolve = (title?: string): string | undefined => {
    if (!connections) return undefined;
    if (title) {
      const byTitle = connections.find((c) => c.title === title);
      if (byTitle) return byTitle.id;
    }
    // fallback: primeira conexão GIS disponível
    return connections.find((c) => c.type === 'GIS_SERVER')?.id ?? connections[0]?.id;
  };

  const visible = layers
    .filter((l) => l.visible !== false)
    .map((l) => ({ ...l, connId: resolve(l.connection) }))
    .filter((l): l is ContextMapLayer & { connId: string } => Boolean(l.connId));

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Carregando mapa…
        </div>
      ) : (
        <>
          <MapContainer
            key={mapKey}
            center={center ?? [-22.2, -48.7]}
            zoom={zoom ?? 6}
            className="h-full w-full"
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {visible.map((l, i) => {
              const params: WmsParamsWithCql = {
                layers: l.layer,
                format: 'image/png',
                transparent: true,
                version: '1.3.0',
              };
              if (l.cql) params.cql_filter = l.cql;
              return (
                <WMSTileLayer
                  key={`${l.connId}:${l.layer}:${l.cql ?? ''}:${i}`}
                  url={renderMapBaseUrl(l.connId)}
                  params={params}
                  opacity={l.opacity ?? 0.8}
                />
              );
            })}
          </MapContainer>

          {visible.length > 0 && (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[500] max-h-[60%] max-w-[45%] overflow-auto rounded-lg border border-slate-200 bg-white/90 p-2 text-[11px] shadow-md backdrop-blur">
              <div className="mb-1 font-semibold text-slate-600">Legenda</div>
              <div className="space-y-1.5">
                {visible.map((l, i) => (
                  <div key={`legend:${l.connId}:${l.layer}:${i}`}>
                    <img
                      src={legendUrl(l.connId, l.layer)}
                      alt={`Legenda da camada ${l.layer}`}
                      className="max-w-full"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
