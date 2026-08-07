import { useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet';
import type { WMSParams } from 'leaflet';
import { renderMapBaseUrl, legendUrl } from '../lib/iubi';
import { useConnections } from '../lib/hooks';
import type { Connection } from '../lib/types';

// GetLegendGraphic direto no GeoServer da conexão — usado como fallback quando o
// proxy de legenda do backend falha (algumas capabilities trazem LegendURL sem
// esquema, o que quebra o proxy). Imagens cross-origin não exigem CORS.
function directLegendUrl(conn: Connection, layer: string): string | undefined {
  if (!conn.serviceUrl) return undefined;
  const sub = (conn.configJson?.subPath as string) || 'ows';
  const base = `${conn.serviceUrl.replace(/\/+$/, '')}/${sub}`;
  const qs = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetLegendGraphic',
    format: 'image/png',
    transparent: 'true',
    layer,
  });
  return `${base}?${qs.toString()}`;
}

// Legenda de uma camada: tenta o proxy same-origin do backend e, em erro, cai
// para o GeoServer direto; se ambos falharem, o quadro é ocultado.
function LegendImg({ connId, conn, layer }: { connId: string; conn?: Connection; layer: string }) {
  const [src, setSrc] = useState(legendUrl(connId, layer));
  const [triedDirect, setTriedDirect] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={`Legenda da camada ${layer}`}
      className="max-w-full rounded bg-white"
      loading="lazy"
      onError={() => {
        const direct = conn ? directLegendUrl(conn, layer) : undefined;
        if (!triedDirect && direct) {
          setTriedDirect(true);
          setSrc(direct);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

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

  const resolveConn = (title?: string): Connection | undefined => {
    if (!connections) return undefined;
    if (title) {
      const byTitle = connections.find((c) => c.title === title);
      if (byTitle) return byTitle;
    }
    // fallback: primeira conexão GIS disponível
    return connections.find((c) => c.type === 'GIS_SERVER') ?? connections[0];
  };

  const visible = layers
    .filter((l) => l.visible !== false)
    .map((l) => {
      const conn = resolveConn(l.connection);
      return { ...l, connId: conn?.id, conn };
    })
    .filter((l): l is ContextMapLayer & { connId: string; conn: Connection } => Boolean(l.connId));

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
                    <LegendImg connId={l.connId} conn={l.conn} layer={l.layer} />
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
