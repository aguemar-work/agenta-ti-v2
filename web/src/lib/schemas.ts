/**
 * lib/schemas.ts
 * Schemas Zod para los tipos del dominio y parsers tipados.
 *
 * Si el schema de BD cambia (campo eliminado, tipo incorrecto), en desarrollo
 * se lanza un SchemaParseError con el detalle exacto del campo que falló.
 * En producción, el error activa el SectionErrorBoundary más cercano — la
 * sección falla de forma aislada sin tumbar el resto de la app.
 *
 * Uso en api/hooks:
 *   import { parseTarea, parseEvento, parseNota, parseUsuario } from '@/lib/schemas';
 */

import { z } from 'zod';

import type { Evento, NotaBitacora, Tarea, Usuario } from '@/types';

// ---------------------------------------------------------------------------
// Primitivos reutilizables
// ---------------------------------------------------------------------------
const id      = z.string().uuid();
const idNul   = z.string().uuid().nullable();
const strNul  = z.string().nullable();
const dateStr = z.string(); // ISO string tal como llega de InsForge

// ---------------------------------------------------------------------------
// Tarea
// ---------------------------------------------------------------------------
export const TareaSchema = z.object({
  id:                 id,
  titulo:             z.string(),
  descripcion:        strNul,
  estado:             z.enum(['pendiente', 'en_progreso', 'reprogramada', 'completada', 'bloqueada', 'atrasada', 'cancelada']),
  tipo:               z.enum(['planificada', 'no_planificada', 'libre']),
  prioridad:          z.enum(['alta', 'media', 'baja']),
  fecha_planificada:  strNul,
  semana_planificada: strNul,
  fecha_completada:   strNul,
  asignado_a:         id,
  objetivo_id:        idNul,
  creado_por:         id,
  es_imprevisto:      z.boolean(),
  created_at:         dateStr,
  updated_at:         dateStr,
});

export type TareaSchema = z.infer<typeof TareaSchema>;

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------
export const EventoSchema = z.object({
  id:            id,
  titulo:        z.string(),
  tipo:          z.enum(['reunion', 'entrega', 'personal', 'otro']),
  fecha_inicio:  dateStr,
  fecha_fin:     dateStr,
  usuario_id:    id,
  es_recurrente: z.boolean(),
  created_at:    dateStr,
  updated_at:    dateStr,
});

export type EventoSchema = z.infer<typeof EventoSchema>;

// ---------------------------------------------------------------------------
// NotaBitacora
// ---------------------------------------------------------------------------
export const NotaBitacoraSchema = z.object({
  id:            id,
  contenido:     z.string(),
  usuario_id:    id,
  objetivo_id:   idNul,
  visibilidad:   z.enum(['todos', 'solo_jefe', 'privado']),
  convertida_en: z.enum(['tarea', 'evento']).nullable(),
  usuario:       z.object({ nombre: z.string() }).nullable().optional(),
  created_at:    dateStr,
  updated_at:    dateStr,
});

export type NotaBitacoraSchema = z.infer<typeof NotaBitacoraSchema>;

// ---------------------------------------------------------------------------
// Usuario
// ---------------------------------------------------------------------------
export const UsuarioSchema = z.object({
  id:         id,
  nombre:     z.string(),
  email:      z.string().email(),
  rol:        z.enum(['jefe', 'miembro']),
  activo:     z.boolean(),
  created_at: dateStr,
  updated_at: dateStr,
});

export type UsuarioSchema = z.infer<typeof UsuarioSchema>;

// ---------------------------------------------------------------------------
// Error tipado para fallos de validacion
// ---------------------------------------------------------------------------

/**
 * Lanzado cuando InsForge devuelve datos que no coinciden con el schema Zod.
 *
 * Al propagarse desde una funcion de API (query/mutacion), activa el
 * SectionErrorBoundary mas cercano. La seccion falla de forma aislada
 * sin tumbar el resto de la app.
 *
 * En DEV: incluye el campo exacto que fallo y el motivo.
 * En produccion: solo el nombre de la entidad (no expone estructura interna).
 */
export class SchemaParseError extends Error {
  readonly label: string;
  readonly issues: z.ZodIssue[];

  constructor(label: string, issues: z.ZodIssue[]) {
    const detail = import.meta.env.DEV
      ? ': ' + issues.map((i) => (i.path.join('.') || '(raiz)') + ' -- ' + i.message).join('; ')
      : '';
    super('[schemas] Dato invalido recibido de la BD para ' + label + detail);
    this.name = 'SchemaParseError';
    this.label = label;
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Parsers tipados
// ---------------------------------------------------------------------------

function safeParse<T>(schema: z.ZodType<T>, row: unknown, label: string): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new SchemaParseError(label, result.error.issues);
  }
  return result.data;
}

export function parseTarea(row: Record<string, unknown>): Tarea {
  return safeParse(TareaSchema, row, 'Tarea') as Tarea;
}

export function parseEvento(row: Record<string, unknown>): Evento {
  return safeParse(EventoSchema, row, 'Evento') as Evento;
}

export function parseNota(row: Record<string, unknown>): NotaBitacora {
  return safeParse(NotaBitacoraSchema, row, 'NotaBitacora') as NotaBitacora;
}

export function parseUsuario(row: Record<string, unknown>): Usuario {
  return safeParse(UsuarioSchema, row, 'Usuario') as Usuario;
}