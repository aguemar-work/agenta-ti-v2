/**
 * lib/constants.ts
 * Constantes de reglas de negocio del dominio SGTD.
 *
 * Fuente de verdad del cliente. Si cambias un valor aquí,
 * sincroniza también la RPC correspondiente en el servidor.
 */

// ---------------------------------------------------------------------------
// Justificaciones y motivos
// ---------------------------------------------------------------------------

/** Longitud mínima de caracteres (trimmed) para cualquier justificación. */
export const MIN_JUSTIFICACION_CHARS = 10;

/** Mensaje de error estándar cuando no se alcanza el mínimo. */
export const MSG_JUSTIFICACION_CORTA = `Debes escribir al menos ${MIN_JUSTIFICACION_CHARS} caracteres.`;

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------

/** Ventana de días hacia atrás para mostrar tareas completadas en el Tablero. */
export const COMPLETADAS_DIAS_LIMITE = 7;

// ---------------------------------------------------------------------------
// Alertas horarias de tareas (vista HOY)
//
// A partir de HORA_PRECAUCION la tarjeta muestra borde ámbar.
// A partir de HORA_URGENTE muestra borde rojo y fondo rosado.
// A partir de HORA_VENCIDA (fin de jornada) la tarea se considera
// vencida en el día y queda en rojo sólido.
// ---------------------------------------------------------------------------

/** Hora (en formato 24h, entero) a partir de la cual la tarea entra en precaución. */
export const HORA_PRECAUCION = 16; // 4:00 pm

/** Hora a partir de la cual la tarea es urgente. */
export const HORA_URGENTE = 17; // 5:00 pm

/** Hora a partir de la cual la tarea se considera vencida en el día. */
export const HORA_VENCIDA = 18; // 6:00 pm

// ---------------------------------------------------------------------------
// Umbrales de progreso de objetivos
//
// El porcentaje de avance se calcula como:
//   sum(puntos de tareas completadas) / sum(puntos de tareas totales) × 100
// donde: alta=3pts, media=2pts, baja=1pt.
//
// Aplica SOLO cuando el objetivo tiene fecha_limite definida.
// Sin fecha_limite → nivel 'sin_fecha' (sin badge de urgencia).
// ---------------------------------------------------------------------------

/** Por debajo de este % con fecha límite activa → nivel 'critico'. */
export const UMBRAL_OBJETIVO_CRITICO   = 30;

/** Por debajo de este % → nivel 'moderado'. */
export const UMBRAL_OBJETIVO_MODERADO  = 50;

/** Por debajo de este % → nivel 'aceptable'. */
export const UMBRAL_OBJETIVO_ACEPTABLE = 70;

/** Por encima de UMBRAL_OBJETIVO_ACEPTABLE → nivel 'en_ritmo'. */

// ---------------------------------------------------------------------------
// Ponderación de prioridades (métricas)
// ---------------------------------------------------------------------------
export const PESO_PRIORIDAD: Record<'alta' | 'media' | 'baja', number> = {
  alta:  3,
  media: 2,
  baja:  1,
};