import { useQuery } from '@tanstack/react-query';

import {
  getJefesActivosParaNotificacion,
  getUsuariosActivosParaAsignacion,
} from '@/api/usuarios';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { qkWsId } from '@/lib/queryKeys';
import type { Usuario } from '@/types';

// ---------------------------------------------------------------------------
// Query keys canónicas — exportadas para invalidaciones explícitas si se necesitan
// ---------------------------------------------------------------------------
export const QUERY_KEY_USUARIOS_ACTIVOS   = 'usuarios-activos';
export const QUERY_KEY_JEFES_NOTIFICACION = 'jefes-notificacion';

// ---------------------------------------------------------------------------

/**
 * Lista de usuarios activos para dropdowns de asignación.
 * Compartida entre MiSemana, Tablero, Objetivos y Planificación.
 * staleTime: 5 min — los usuarios activos no cambian con frecuencia.
 */
export function useUsuariosActivos(options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  const enabled = (options?.enabled ?? true) && Boolean(workspaceId);
  return useQuery<Pick<Usuario, 'id' | 'nombre' | 'email'>[]>({
    queryKey: qkWsId(workspaceId, QUERY_KEY_USUARIOS_ACTIVOS),
    queryFn:  () => getUsuariosActivosParaAsignacion(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Lista de jefes activos para enviar notificaciones.
 * Compartida entre MiSemana y Tablero.
 * staleTime: 10 min — los jefes cambian muy raramente.
 */
export function useJefesNotificacion(options?: { enabled?: boolean }) {
  const workspaceId = useWorkspaceId();
  const enabled = (options?.enabled ?? true) && Boolean(workspaceId);
  return useQuery<Pick<Usuario, 'id' | 'nombre'>[]>({
    queryKey: qkWsId(workspaceId, QUERY_KEY_JEFES_NOTIFICACION),
    queryFn:  () => getJefesActivosParaNotificacion(),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
}
