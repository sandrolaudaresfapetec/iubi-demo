import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Search, X, Plus, Check, Info } from 'lucide-react';
import { useGisConnections, useLayerCapabilities } from '../lib/hooks';
import { legendUrl } from '../lib/iubi';
import { StateWrapper, Badge } from '../components/ui';
import { MapView, type ActiveLayer, type FeatureInfoResult } from '../components/MapView';
import type { LayerCapability } from '../lib/types';

export function MapExplorerPage() {
  const gis = useGisConnections();
  const [connectionId, setConnectionId] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<ActiveLayer[]>([]);
  const [featureInfo, setFeatureInfo] = useState<FeatureInfoResult | null>(null);
  const [panelWidth, setPanelWidth] = useState(384);
  const draggingRef = useRef(false);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setPanelWidth(Math.min(640, Math.max(240, e.clientX)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const effectiveConn = connectionId || gis.data?.[0]?.id || '';
  const caps = useLayerCapabilities(effectiveConn);

  const filtered = useMemo(() => {
    const list = caps.data ?? [];
    if (!filter.trim()) return list;
    const f = filter.toLowerCase();
    return list.filter(
      (l) => l.title.toLowerCase().includes(f) || l.map.layers.toLowerCase().includes(f),
    );
  }, [caps.data, filter]);

  const layerKey = (a: ActiveLayer) => `${a.connectionId}:${a.layer.map.layers}`;

  const isActive = (l: LayerCapability) =>
    active.some((a) => a.connectionId === effectiveConn && a.layer.map.layers === l.map.layers);

  const toggleLayer = (l: LayerCapability, connectionId = effectiveConn) => {
    setActive((prev) => {
      const exists = prev.some(
        (a) => a.connectionId === connectionId && a.layer.map.layers === l.map.layers,
      );
      if (exists) {
        return prev.filter(
          (a) => !(a.connectionId === connectionId && a.layer.map.layers === l.map.layers),
        );
      }
      return [...prev, { connectionId, layer: l }];
    });
  };

  return (
    <div className="h-[calc(100vh-4rem-2.5rem)] flex">
      {/* Painel de camadas */}
      <aside
        style={{ width: panelWidth }}
        className="shrink-0 border-r border-slate-200 bg-white flex flex-col"
      >
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <Layers size={18} /> Catálogo de camadas
          </div>
          <select
            value={effectiveConn}
            onChange={(e) => {
              setConnectionId(e.target.value);
              setFilter('');
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iubi-300"
          >
            {gis.isLoading && <option>Carregando conexões…</option>}
            {gis.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.provider})
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar camadas…"
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iubi-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <StateWrapper
            isLoading={caps.isLoading}
            error={caps.error}
            isEmpty={filtered.length === 0}
            loadingLabel="Carregando camadas…"
            emptyLabel="Nenhuma camada encontrada."
          >
            <ul className="space-y-1.5">
              {filtered.map((l) => {
                const on = isActive(l);
                return (
                  <li key={l.map.layers}>
                    <button
                      onClick={() => toggleLayer(l)}
                      className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                        on
                          ? 'border-iubi-300 bg-iubi-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 rounded p-0.5 ${
                            on ? 'bg-iubi-600 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {on ? <Check size={13} /> : <Plus size={13} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate" title={l.title}>
                            {l.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {l.map.layers}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </StateWrapper>
        </div>
      </aside>

      {/* Divisória arrastável */}
      <div
        onPointerDown={startResize}
        title="Arraste para redimensionar o painel"
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-iubi-400"
      >
        <span className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Mapa */}
      <div className="relative flex-1 min-w-0">
        <MapView layers={active} onFeatureInfo={setFeatureInfo} />

        {/* Camadas ativas + legenda */}
        {active.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] w-64 max-h-[70%] overflow-y-auto rounded-xl bg-white/95 backdrop-blur shadow-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Camadas ativas
              </span>
              <button
                onClick={() => setActive([])}
                className="text-[11px] text-slate-400 hover:text-red-500"
              >
                limpar
              </button>
            </div>
            <ul className="space-y-2">
              {active.map((a) => (
                <li key={layerKey(a)} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700" title={a.layer.title}>
                      {a.layer.title}
                    </span>
                    <button
                      onClick={() => toggleLayer(a.layer, a.connectionId)}
                      className="text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <img
                    src={legendUrl(a.connectionId, a.layer.map.layers)}
                    alt="legenda"
                    className="mt-1 max-h-24 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {active.length === 0 && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
            <div className="rounded-xl bg-white/90 px-5 py-3 text-sm text-slate-500 shadow">
              Selecione camadas no painel à esquerda para exibi-las no mapa.
            </div>
          </div>
        )}

        {/* Feature info */}
        {featureInfo && (
          <div className="absolute bottom-3 left-3 z-[1000] w-96 max-h-[50%] overflow-y-auto rounded-xl bg-white shadow-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Info size={15} /> Informações da feição
              </span>
              <button
                onClick={() => setFeatureInfo(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 text-xs">
              <div className="mb-2 text-slate-400">
                {featureInfo.latlng.lat.toFixed(5)}, {featureInfo.latlng.lng.toFixed(5)}
              </div>
              {featureInfo.loading && <div className="text-slate-400">Consultando…</div>}
              {featureInfo.error && <div className="text-red-600">{featureInfo.error}</div>}
              {!featureInfo.loading && !featureInfo.error && (
                <FeatureInfoContent data={featureInfo.data} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureInfoContent({ data }: { data: unknown }) {
  const features = extractFeatures(data);
  if (features.length === 0) {
    return <div className="text-slate-400">Nenhuma feição neste ponto.</div>;
  }
  return (
    <div className="space-y-3">
      {features.map((props, idx) => (
        <div key={idx}>
          {features.length > 1 && (
            <div className="mb-1">
              <Badge tone="blue">feição {idx + 1}</Badge>
            </div>
          )}
          <table className="w-full">
            <tbody>
              {Object.entries(props).map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-500 align-top">{k}</td>
                  <td className="py-1 text-slate-700 break-words">{formatValue(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function extractFeatures(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.features)) {
    return (obj.features as Array<Record<string, unknown>>).map((f) => {
      const props = (f as { properties?: Record<string, unknown> }).properties;
      return props && typeof props === 'object' ? props : (f as Record<string, unknown>);
    });
  }
  return [obj];
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
