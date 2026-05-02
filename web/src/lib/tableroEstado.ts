/**
 * lib/tableroEstado.ts
 *
 * Con el trigger de BD (migración 009), el estado 'atrasada' ya llega
 * correcto desde Postgres. Esta función ya no necesita calcularlo —
 * simplemente devuelve el estado real de la tarea.
 *
 * Se mantiene el nombre para no romper los imports existentes.
 */

import type { EstadoTarea, Tarea } from '@/types';

/**
 * Devuelve el estado efectivo de la tarea para el Tablero.
 *
 * Antes calculaba 'atrasada' en el cliente. Ahora el trigger en BD
 * ya lo hace, así que simplemente retornamos tarea.estado.
 *
 * La firma se mantiene igual para compatibilidad con código existente.
 */
export function estadoEfectivoTablero(tarea: Tarea, _hoyYmd: string): EstadoTarea {
  return tarea.estado;
}