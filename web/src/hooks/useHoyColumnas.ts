import { useQuery } from '@tanstack/react-query';

import {
  crearIncidencia,
  getEventosDelDia,
  getIncidenciasAbiertas,
  getIncidenciasDelDia,
  getNotasBitacoraRecientes,
} from '@/api/hoyColumnas';

export const Q_INC_HOY  = 'hoy-incidencias';
export const Q_INC_HIST = 'hoy-incidencias-historico';
export const Q_EV_HOY   = 'hoy-eventos';
export const Q_NOTAS_HOY = 'hoy-notas-bitacora';

export function useIncidenciasHoy(usuarioId: string | undefined) {
  return useQuery({
    queryKey: [Q_INC_HOY, usuarioId],
    enabled:  Boolean(usuarioId),
    queryFn:  () => getIncidenciasAbiertas(usuarioId!),
  });
}

export function useIncidenciasHistoricasHoy(usuarioId: string | undefined) {
  return useQuery({
    queryKey: [Q_INC_HIST, usuarioId],
    enabled:  Boolean(usuarioId),
    queryFn:  () => getIncidenciasDelDia(usuarioId!, new Date().toISOString().slice(0, 10)),
  });
}

export function useIncidenciasDelDia(usuarioId: string | undefined, ymd: string) {
  return useQuery({
    queryKey: [Q_INC_HOY, usuarioId, ymd],
    enabled:  Boolean(usuarioId),
    queryFn:  () => getIncidenciasDelDia(usuarioId!, ymd),
  });
}

export function useEventosHoy(usuarioId: string | undefined, ymd: string) {
  return useQuery({
    queryKey: [Q_EV_HOY, usuarioId, ymd],
    enabled:  Boolean(usuarioId),
    queryFn:  () => getEventosDelDia(usuarioId!, ymd),
  });
}

export function useNotasBitacoraHoy(usuarioId: string | undefined, esJefe = false) {
  return useQuery({
    queryKey: [Q_NOTAS_HOY, usuarioId, esJefe],
    enabled:  Boolean(usuarioId),
    queryFn:  () => getNotasBitacoraRecientes(usuarioId!, 8, esJefe),
  });
}

export { crearIncidencia };