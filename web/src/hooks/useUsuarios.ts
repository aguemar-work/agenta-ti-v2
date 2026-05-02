/**
 * hooks/useUsuarios.ts
 * Hooks compartidos para listas de usuarios.
 *
 * Centraliza las queryKeys canónicas para que TanStack Query deduplique
 * y comparta caché entre todas las páginas que necesiten estos datos.
 *
 * Antes de este hook, la misma llamada a getUsuariosActivosParaAsignacion()
 * se registraba con 4 queryKeys distintas ('usuarios-asignacion-mi-semana',
 * '-tablero', '-objetivos', 'usuarios-para-audit'), impidiendo la deduplicación
 * y causando 4 fetch paralelos para los mismos datos.
 *
 * Uso:
 *   const { data: usuarios = [] } = useUsuariosActivos();
 *   const { data: jefes = [] }    = useJefesNotificacion();
 */

import { useQuery } from '@tanstack/react-query';

import {
  getJefesActivosParaNotificacion,
  getUsuariosActivosParaAsignacion,
} from '@/api/usuarios';
import type { Usuario } from '@/types';

// ---------------------------------------------------------------------------
// Query keys canónicas — exportadas para invalidaciones explícitas si se necesitan
// ---------------------------------------------------------------------------
export const QUERY_KEY_USUARIOS_ACTIVOS   = ['usuarios-activos']   as const;
export const QUERY_KEY_JEFES_NOTIFICACION = ['jefes-notificacion'] as const;

// ---------------------------------------------------------------------------

/**
 * Lista de usuarios activos para dropdowns de asignación.
 * Compartida entre MiSemana, Tablero, Objetivos y Planificación.
 * staleTime: 5 min — los usuarios activos no cambian con frecuencia.
 */
export function useUsuariosActivos(options?: { enabled?: boolean }) {
  return useQuery<Pick<Usuario, 'id' | 'nombre' | 'email'>[]>({
    queryKey: QUERY_KEY_USUARIOS_ACTIVOS,
    queryFn:  () => getUsuariosActivosParaAsignacion(),
    staleTime: 5 * 60 * 1000,
    enabled:  options?.enabled ?? true,
  });
}

/**
 * Lista de jefes activos para enviar notificaciones.
 * Compartida entre MiSemana y Tablero.
 * staleTime: 10 min — los jefes cambian muy raramente.
 */
export function useJefesNotificacion(options?: { enabled?: boolean }) {
  return useQuery<Pick<Usuario, 'id' | 'nombre'>[]>({
    queryKey: QUERY_KEY_JEFES_NOTIFICACION,
    queryFn:  () => getJefesActivosParaNotificacion(),
    staleTime: 10 * 60 * 1000,
    enabled:  options?.enabled ?? true,
  });
}