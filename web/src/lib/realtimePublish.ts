/**
 * lib/realtimePublish.ts
 *
 * Utilidades para publicar eventos de notificación desde mutaciones.
 * Falla silenciosamente — las notificaciones son mejora opcional,
 * nunca deben bloquear la mutación principal.
 */

import { getInsforge } from '@/lib/insforge';

type EventoEquipo =
  | { tipo: 'tarea_completada'; jefeId: string; tareaId: string; titulo: string; usuarioNombre: string; resumen?: string }
  | { tipo: 'ot_enviada';       jefeId: string; otId: string; numero: string; usuarioNombre: string }
  | { tipo: 'incidencia_registrada'; jefeId: string; titulo: string; usuarioNombre: string };

type EventoUsuario =
  | { tipo: 'tarea_asignada'; usuarioId: string; tareaId: string; titulo: string; asignadoPor: string }
  | { tipo: 'ot_aprobada';    usuarioId: string; otId: string; numero: string }
  | { tipo: 'ot_rechazada';   usuarioId: string; otId: string; numero: string; motivo?: string };

/** Publica un evento dirigido al equipo (canal del Jefe). */
export async function publicarEventoEquipo(evento: EventoEquipo): Promise<void> {
  try {
    const rt = getInsforge().realtime;
    await rt.publish(`equipo:${evento.jefeId}`, evento.tipo, evento);
  } catch (err) {
    console.warn('[publicarEventoEquipo]', err);
  }
}

/** Publica un evento dirigido a un usuario específico. */
export async function publicarEventoUsuario(evento: EventoUsuario): Promise<void> {
  try {
    const rt = getInsforge().realtime;
    await rt.publish(`usuario:${evento.usuarioId}`, evento.tipo, evento);
  } catch (err) {
    console.warn('[publicarEventoUsuario]', err);
  }
}