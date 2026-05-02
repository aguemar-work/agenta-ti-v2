/**
 * api/recurrencia.ts
 * Operaciones sobre eventos recurrentes.
 * La lógica de negocio (validación, generación de instancias) vive en el servidor.
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
  fecha_fin?: string;    // 'YYYY-MM-DD' — null = sin fin
  meses?: number;        // cuántos meses generar (default 1)
};

/**
 * Crea la regla de recurrencia y genera las instancias del período en un solo paso.
 * Devuelve el id de la recurrencia creada.
 */
export async function crearRecurrenciaEvento(
  input: CrearRecurrenciaEventoInput,
): Promise<string> {
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
      p_meses:        input.meses ?? 1,
    },
  );
  if (error) throw error;
  return data as string;
}

/**
 * Extiende las instancias de una recurrencia existente al siguiente período.
 * Útil para el botón "Generar próximo mes".
 */
export async function extenderRecurrenciaEvento(
  recurrenciaId: string,
  mesesAdelante = 1,
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