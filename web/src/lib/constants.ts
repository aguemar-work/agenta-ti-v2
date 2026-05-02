/**
 * lib/constants.ts
 * Constantes de reglas de negocio del dominio SGTD.
 *
 * Centraliza valores que aparecen en múltiples puntos del código
 * (validaciones API, UI, hooks) para que un cambio de regla se aplique
 * en un solo lugar.
 *
 * IMPORTANTE: estas constantes reflejan la validación del cliente.
 * La fuente de verdad sigue siendo el servidor (RPCs en Supabase).
 * Si cambias un valor aquí, sincroniza también la RPC correspondiente.
 */

// ---------------------------------------------------------------------------
// Justificaciones y motivos
// ---------------------------------------------------------------------------

/**
 * Longitud mínima de caracteres (trimmed) para cualquier campo de
 * justificación o motivo en el sistema.
 *
 * Aplica en:
 *   - api/semana.ts       → reprogramar, bloquear, eliminar tarea, motivo bloqueo
 *   - api/objetivos.ts    → motivo al eliminar objetivo
 *   - hooks/usePlanificacionPage.ts → motivo devolver tarea
 *   - pages/OrdenesTrabajo.tsx      → motivo rechazo OT
 */
export const MIN_JUSTIFICACION_CHARS = 10;

/** Ventana de días hacia atrás para mostrar tareas completadas en el Tablero. */
export const COMPLETADAS_DIAS_LIMITE = 7;

/** Mensaje de error estándar cuando no se alcanza el mínimo. */
export const MSG_JUSTIFICACION_CORTA = `Debes escribir al menos ${MIN_JUSTIFICACION_CHARS} caracteres.`;