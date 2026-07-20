import { useQuery } from '@tanstack/react-query';
import {
  getContext,
  getLayerSchema,
  getStatisticsCapabilities,
  listConnections,
  listContexts,
  listLayerCapabilities,
} from './iubi';
import type { ContextType } from './types';

export function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: listConnections });
}

export function useGisConnections() {
  const query = useConnections();
  return {
    ...query,
    data: query.data?.filter((c) => c.type === 'GIS_SERVER'),
  };
}

export function useLayerCapabilities(connectionId: string | undefined) {
  return useQuery({
    queryKey: ['layer-capabilities', connectionId],
    queryFn: () => listLayerCapabilities(connectionId!),
    enabled: Boolean(connectionId),
  });
}

export function useLayerSchema(connectionId: string | undefined, layer: string | undefined) {
  return useQuery({
    queryKey: ['layer-schema', connectionId, layer],
    queryFn: () => getLayerSchema(connectionId!, layer!),
    enabled: Boolean(connectionId && layer),
  });
}

export function useStatisticsCapabilities(
  connectionId: string | undefined,
  layer: string | undefined,
) {
  return useQuery({
    queryKey: ['stats-caps', connectionId, layer],
    queryFn: () => getStatisticsCapabilities(connectionId!, layer!),
    enabled: Boolean(connectionId && layer),
  });
}

export function useContexts(type: ContextType, q?: string) {
  return useQuery({
    queryKey: ['contexts', type, q ?? ''],
    queryFn: () => listContexts(type, q),
  });
}

export function useContext(type: ContextType, ctxId: string | undefined) {
  return useQuery({
    queryKey: ['context', type, ctxId],
    queryFn: () => getContext(type, ctxId!),
    enabled: Boolean(ctxId),
  });
}
