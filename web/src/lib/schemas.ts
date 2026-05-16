/**
 * lib/schemas.ts
 * Schemas Zod para los tipos del dominio y parsers tipados.
 */

import { z } from 'zod';
import type { Evento, NotaBitacora, Tarea, Usuario } from '@/types';
import { OT_MIGRATION_028_APLICADA, ordenTrabajoCompletadaTieneReceptor } from '@/lib/otComplecion';

const id      = z.string().uuid();
const idNul   = z.string().uuid().nullable();
const strNul  = z.string().nullable();
const dateStr = z.string();

// ---------------------------------------------------------------------------
// Tarea — 'libre' eliminado, nota_origen_id agregado
// ---------------------------------------------------------------------------
export const TareaSchema = z.object({
  id:                 id,
  titulo:             z.string(),
  descripcion:        strNul,
  estado:             z.enum(['pendiente', 'en_progreso', 'reprogramada', 'completada', 'bloqueada', 'atrasada', 'cancelada']),
  tipo:               z.enum(['planificada', 'no_planificada']),
  prioridad:          z.enum(['alta', 'media', 'baja']),
  fecha_planificada:  strNul,
  semana_planificada: strNul,
  fecha_completada:   strNul,
  asignado_a:         id,
  objetivo_id:        idNul,
  creado_por:         id,
  es_imprevisto:      z.boolean(),
  nota_origen_id:     idNul,
  created_at:         dateStr,
  updated_at:         dateStr,
});

export type TareaSchema = z.infer<typeof TareaSchema>;

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------
export const EventoSchema = z.object({
  id:             id,
  titulo:         z.string(),
  tipo:           z.enum(['reunion', 'entrega', 'personal', 'otro']),
  fecha_inicio:   dateStr,
  fecha_fin:      dateStr,
  usuario_id:     id,
  es_recurrente:  z.boolean(),
  recurrencia_id: id.nullable().optional(),
  created_at:     dateStr,
  updated_at:     dateStr,
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
// Error tipado para fallos de validación
// ---------------------------------------------------------------------------
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

function safeParse<T>(schema: z.ZodType<T>, row: unknown, label: string): T {
  const result = schema.safeParse(row);
  if (!result.success) throw new SchemaParseError(label, result.error.issues);
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

// ---------------------------------------------------------------------------
// OrdenTrabajo
// ---------------------------------------------------------------------------
export const TipoTrabajoOTSchema = z.object({
  id:         z.string().uuid(),
  nombre:     z.string(),
  activo:     z.boolean(),
  created_at: z.string(),
});

export const OrdenTrabajoSchema = z.object({
  id:                   z.string().uuid(),
  numero:               z.string(),
  creado_por:           z.string().uuid(),
  tipo_trabajo_id:      z.string().uuid().nullable(),
  tarea_id:             z.string().uuid().nullable(),
  objetivo_id:          z.string().uuid().nullable(),
  estado:               z.enum(['borrador', 'pendiente', 'aprobada', 'en_ejecucion', 'completada', 'rechazada', 'cancelada']),
  prioridad:            z.enum(['normal', 'urgente']),
  descripcion:          z.string(),
  area_destino:         z.string(),
  ubicacion:            z.string().nullable(),
  modalidad:            z.enum(['presencial', 'remoto', 'viaje']),
  fecha_estimada:       z.string(),
  hora_inicio_est:      z.string().nullable(),
  duracion_est_min:     z.number().nullable(),
  equipos_materiales:   z.string().nullable(),
  observaciones:        z.string().nullable(),
  aprobado_por:         z.string().uuid().nullable(),
  fecha_aprobacion:     z.string().nullable(),
  motivo_rechazo:       z.string().nullable(),
  fecha_inicio_real:    z.string().nullable(),
  fecha_fin_real:       z.string().nullable(),
  observaciones_cierre: z.string().nullable(),
  receptor_nombre:      z.string().nullable(),
  receptor_dni:         z.string().nullable(),
  receptor_cargo:       z.string().nullable(),
  created_at:           z.string(),
  updated_at:           z.string(),
  // Relaciones opcionales (joins)
  tipo_trabajo: z.object({ nombre: z.string() }).nullable().optional(),
  creador:      z.object({ nombre: z.string(), email: z.string() }).nullable().optional(),
  aprobador:    z.object({ nombre: z.string() }).nullable().optional(),
  tarea:        z.object({ titulo: z.string() }).nullable().optional(),
  objetivo:     z.object({ titulo: z.string() }).nullable().optional(),
}).superRefine((ot, ctx) => {
  if (!OT_MIGRATION_028_APLICADA) return;
  if (ordenTrabajoCompletadaTieneReceptor(ot)) return;
  if (!ot.receptor_nombre?.trim()) {
    ctx.addIssue({
      code:     'custom',
      path:     ['receptor_nombre'],
      message:  'OT completada sin nombre de receptor (migración 028)',
    });
  }
  if (!ot.receptor_dni?.trim()) {
    ctx.addIssue({
      code:     'custom',
      path:     ['receptor_dni'],
      message:  'OT completada sin DNI de receptor (migración 028)',
    });
  }
});

export function parseTipoTrabajoOT(row: Record<string, unknown>) {
  return safeParse(TipoTrabajoOTSchema, row, 'TipoTrabajoOT');
}

export function parseOrdenTrabajo(row: Record<string, unknown>) {
  return safeParse(OrdenTrabajoSchema, row, 'OrdenTrabajo');
}