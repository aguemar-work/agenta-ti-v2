/**
 * api/recurrencia.ts
 * Eventos recurrentes: validación en cliente + RPC / PostgREST.
 * La generación de instancias vive en el servidor (migraciones 025–026).
 */

import { getInsforge } from '@/lib/insforge';

export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1=Lun … 7=Dom

export type CrearRecurrenciaEventoInput = {
  titulo: string;
  tipo: 'reunion' | 'entrega' | 'personal' | 'otro';
  hora_inicio: string;   // 'HH:MM'
  hora_fin: string;      // 'HH:MM'
  usuario_id: string;
  dias_semana: DiaSemana[];
  fecha_inicio: string;  // 'YYYY-MM-DD' — primer día desde el que aplica
  fecha_fin?: string;    // 'YYYY-MM-DD' — sin fin si se omite
  meses?: number;        // cuántos meses generar (default 3)
};

/** Alcance al eliminar un evento que pertenece a una serie recurrente. */
export type AlcanceEliminarEventoRecurrente = 'solo_este' | 'toda_serie';

export class RecurrenciaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecurrenciaValidationError';
  }
}

/**
 * Valida reglas de negocio antes de llamar al RPC.
 * Alineado con sgtd_crear_recurrencia_evento (BD) y RecurrenciaForm (UI).
 */
export function validarCrearRecurrenciaEventoInput(
  input: CrearRecurrenciaEventoInput,
): void {
  if (!input.titulo.trim()) {
    throw new RecurrenciaValidationError('El título de la recurrencia es obligatorio.');
  }

  if (!input.dias_semana.length) {
    throw new RecurrenciaValidationError('Debes seleccionar al menos un día de la semana.');
  }

  if (input.hora_fin <= input.hora_inicio) {
    throw new RecurrenciaValidationError(
      'La hora de fin debe ser posterior a la hora de inicio.',
    );
  }

  if (input.fecha_fin && input.fecha_fin < input.fecha_inicio) {
    throw new RecurrenciaValidationError(
      'La fecha de fin no puede ser anterior a la fecha de inicio.',
    );
  }
}

/**
 * Crea la regla de recurrencia y genera las instancias del período en un solo paso.
 * Devuelve el id de la recurrencia creada.
 */
export async function crearRecurrenciaEvento(
  input: CrearRecurrenciaEventoInput,
): Promise<string> {
  validarCrearRecurrenciaEventoInput(input);

  const { data, error } = await getInsforge().database.rpc(
    'sgtd_crear_recurrencia_evento',
    {
      p_titulo:       input.titulo.trim(),
      p_tipo:         input.tipo,
      p_hora_inicio:  input.hora_inicio,
      p_hora_fin:     input.hora_fin,
      p_usuario_id:   input.usuario_id,
      p_dias_semana:  input.dias_semana,
      p_fecha_inicio: input.fecha_inicio,
      p_fecha_fin:    input.fecha_fin ?? null,
      p_meses:        input.meses ?? 3,
    },
  );
  if (error) throw error;
  return data as string;
}

/**
 * Extiende las instancias de una recurrencia existente al siguiente período.
 */
export async function extenderRecurrenciaEvento(
  recurrenciaId: string,
  mesesAdelante = 3,
): Promise<number> {
  const { data, error } = await getInsforge().database.rpc(
    'sgtd_generar_eventos_recurrentes',
    {
      p_recurrencia_id: recurrenciaId,
      p_meses_adelante: mesesAdelante,
    },
  );
  if (error) throw error;
  return data as number;
}

/**
 * Elimina un evento recurrente según el alcance elegido por el usuario.
 * - solo_este: borra solo la fila en `evento`.
 * - toda_serie: borra todas las instancias con `recurrencia_id` y la regla en `recurrencia_evento`.
 */
export async function eliminarEventoRecurrente(input: {
  eventoId: string;
  recurrenciaId: string | null | undefined;
  alcance: AlcanceEliminarEventoRecurrente;
}): Promise<void> {
  const insforge = getInsforge();

  if (input.alcance === 'solo_este') {
    const { error } = await insforge.database
      .from('evento')
      .delete()
      .eq('id', input.eventoId);
    if (error) throw error;
    return;
  }

  if (!input.recurrenciaId) {
    throw new RecurrenciaValidationError(
      'No se puede eliminar toda la serie sin identificador de recurrencia.',
    );
  }

  const { error: errInstancias } = await insforge.database
    .from('evento')
    .delete()
    .eq('recurrencia_id', input.recurrenciaId);
  if (errInstancias) throw errInstancias;

  const { error: errRegla } = await insforge.database
    .from('recurrencia_evento')
    .delete()
    .eq('id', input.recurrenciaId);
  if (errRegla) throw errRegla;
}

export type RecurrenciaEvento = {
  id: string;
  titulo: string;
  tipo: string;
  hora_inicio: string;
  hora_fin: string;
  usuario_id: string;
  dias_semana: DiaSemana[];
  fecha_inicio: string;
  fecha_fin: string | null;
  generado_hasta: string | null;
  created_at: string;
};

/** Lista las recurrencias activas del usuario (o de todo el equipo si es jefe). */
export async function getRecurrenciasEvento(
  usuarioId?: string,
): Promise<RecurrenciaEvento[]> {
  const insforge = getInsforge();
  let q = insforge.database
    .from('recurrencia_evento')
    .select('*')
    .order('created_at', { ascending: false });

  if (usuarioId) {
    q = q.eq('usuario_id', usuarioId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RecurrenciaEvento[];
}
