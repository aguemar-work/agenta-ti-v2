import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  completarTareaConResumen as completarTareaConResumenApi,
  getTareasHoyUsuario,
  marcarAtrasadasEquipo,
  reprogramarTareaConLog as reprogramarTareaConLogApi,
} from '@/api/semana';
import { getUsuariosParaSelector } from '@/api/usuarios';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { fechaLocalYmd } from '@/lib/fecha';
import { getInsforge } from '@/lib/insforge';
import { qkWsId } from '@/lib/queryKeys';
import { TAREA_ACTIVA } from '@/lib/tareaTables';

const Q_HOY = 'tareas-hoy';

// Throttle: ejecutar el RPC de marcado como máximo 1 vez cada 30 minutos por sesión.
// Sin esto, el RPC se dispara en cada navegación a /semana haciendo un UPDATE masivo
// innecesario en la tabla de tareas.
const THROTTLE_KEY    = 'sgtd-marcar-atrasadas-ts';
const THROTTLE_MS     = 30 * 60 * 1000; // 30 minutos

function debeEjecutarMarcarAtrasadas(): boolean {
  try {
    const ts = sessionStorage.getItem(THROTTLE_KEY);
    if (!ts) return true;
    return Date.now() - Number(ts) > THROTTLE_MS;
  } catch {
    return true; // sessionStorage no disponible → ejecutar igual
  }
}

function registrarEjecucionMarcarAtrasadas(): void {
  try {
    sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
  } catch { /* ignorar */ }
}

/**
 * Dispara el RPC `sgtd_marcar_atrasadas_equipo` al montar la vista,
 * con throttle de 30 minutos por sesión para evitar UPDATE masivos en
 * cada navegación.
 *
 * El trigger BEFORE UPDATE gestiona casos individuales en tiempo real;
 * este hook hace una pasada masiva para tareas que quedaron sin procesar
 * (ej. usuario sin sesión activa varios días).
 */
export function useMarcarAtrasadasAlMontar(asignadoA: string | undefined) {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (!asignadoA || !workspaceId) return;
    if (!debeEjecutarMarcarAtrasadas()) return;
    let cancelled = false;
    void (async () => {
      try {
        registrarEjecucionMarcarAtrasadas();
        await marcarAtrasadasEquipo();
        if (!cancelled) {
          await qc.invalidateQueries({
            refetchType: 'active',
            queryKey: qkWsId(workspaceId, Q_HOY, asignadoA),
          });
        }
      } catch (err) {
        console.error('[useMarcarAtrasadasAlMontar]', err);
      }
    })();
    return () => { cancelled = true; };
  }, [asignadoA, workspaceId, qc]);
}

export function useTareasHoy(asignadoA: string | undefined) {
  const workspaceId = useWorkspaceId();
  const hoy = fechaLocalYmd(new Date());
  return useQuery({
    queryKey: qkWsId(workspaceId, Q_HOY, asignadoA, hoy),
    enabled: Boolean(asignadoA) && Boolean(workspaceId),
    queryFn: () => getTareasHoyUsuario(asignadoA!, hoy),
  });
}

export function useUsuariosParaSelector(esJefe: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: qkWsId(workspaceId, 'usuarios-selector'),
    enabled: esJefe && Boolean(workspaceId),
    queryFn: () => getUsuariosParaSelector(),
  });
}

export async function completarTarea(tareaId: string): Promise<void> {
  const insforge = getInsforge();
  const { error } = await insforge.database
    .from(TAREA_ACTIVA)
    .update({ estado: 'completada', fecha_completada: new Date().toISOString() })
    .eq('id', tareaId);
  if (error) throw error;
}

/** @deprecated Importar desde `@/api/semana` — reexport por compatibilidad. */
export const completarTareaConResumen = completarTareaConResumenApi;

export async function reprogramarTareaConLog(input: {
  tareaId:       string;
  usuarioId:     string;
  nuevaFecha:    string;
  justificacion: string;
}): Promise<void> {
  return reprogramarTareaConLogApi(input);
}
