import { getInsforge } from '@/lib/insforge';
import { fechaLocalYmd } from '@/lib/fecha';
import { parseTarea } from '@/lib/schemas';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { EstadoTarea, Tarea } from '@/types';

export type FiltrosTablero = {
  usuarioId: string | 'todos';
  objetivoId: string | 'todos';
  mostrarCompletadas: boolean;
};

export async function getTareasTablero(filtros: FiltrosTablero): Promise<Tarea[]> {
  const insforge = getInsforge();
  let q = insforge.database.from('tarea').select('*');

  if (filtros.usuarioId !== 'todos') {
    q = q.eq('asignado_a', filtros.usuarioId);
  }
  if (filtros.objetivoId !== 'todos') {
    q = q.eq('objetivo_id', filtros.objetivoId);
  }

  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw error;
  let list = (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
  list = list.filter((t) => t.estado !== 'cancelada');

  const hoy = fechaLocalYmd(new Date());
  if (!filtros.mostrarCompletadas) {
    list = list.filter((t) => t.estado !== 'completada');
  } else {
    const limite = new Date();
    limite.setDate(limite.getDate() - 7);
    const limiteIso = limite.toISOString();
    list = list.filter((t) => {
      if (t.estado !== 'completada') return true;
      return t.fecha_completada && t.fecha_completada >= limiteIso;
    });
  }

  list.sort((a, b) => {
    const ea = estadoEfectivoTablero(a, hoy);
    const eb = estadoEfectivoTablero(b, hoy);
    return ea.localeCompare(eb);
  });
  return list;
}

/** Columnas visibles del tablero (4): pendiente incluye tareas con efectivo "atrasada". */
export type ColumnaTableroId = 'pendiente' | 'en_progreso' | 'bloqueada' | 'completada';

export function agruparTareasTablero(tareas: Tarea[], hoyYmd: string): Record<ColumnaTableroId, Tarea[]> {
  const cols: Record<ColumnaTableroId, Tarea[]> = {
    pendiente: [],
    en_progreso: [],
    bloqueada: [],
    completada: [],
  };
  for (const t of tareas) {
    const e = estadoEfectivoTablero(t, hoyYmd);
    if (e === 'completada') cols.completada.push(t);
    else if (e === 'bloqueada') cols.bloqueada.push(t);
    else if (e === 'en_progreso') cols.en_progreso.push(t);
    else cols.pendiente.push(t);
  }
  return cols;
}

/** Reanuda una tarea planificada vencida en el día actual (columna Por hacer). */
export async function snapTareaFechaAlPorHacer(tareaId: string, hoyYmd: string): Promise<void> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${hoyYmd}T12:00:00`));
  const { error } = await insforge.database
    .from('tarea')
    .update({
      fecha_planificada: hoyYmd,
      semana_planificada: semana,
      estado: 'pendiente',
    })
    .eq('id', tareaId);
  if (error) throw error;
}

export async function moverTareaColumna(
  tareaId: string,
  nuevoEstado: EstadoTarea,
  usuarioActorId: string,
  justificacion?: string,
): Promise<void> {
  const insforge = getInsforge();
  const requiere = nuevoEstado === 'bloqueada' || nuevoEstado === 'cancelada';
  if (requiere && (!justificacion || justificacion.trim().length < 10)) {
    throw new Error('Justificación obligatoria (mínimo 10 caracteres).');
  }

  const { data: prevRow, error: e0 } = await insforge.database.from('tarea').select('estado').eq('id', tareaId).single();
  if (e0) throw e0;
  const prev = (prevRow as { estado: EstadoTarea }).estado;

  const patch: Partial<Tarea> = { estado: nuevoEstado };
  if (nuevoEstado === 'completada') {
    patch.fecha_completada = new Date().toISOString();
  }
  const { error: e1 } = await insforge.database.from('tarea').update(patch).eq('id', tareaId);
  if (e1) throw e1;

  if (nuevoEstado === 'bloqueada' || nuevoEstado === 'cancelada') {
    const tipoLog = nuevoEstado === 'bloqueada' ? 'estado_cambiado' : 'cancelada';
    const { error: e2 } = await insforge.database.from('log_accion').insert([
      {
        tarea_id: tareaId,
        usuario_id: usuarioActorId,
        tipo_accion: tipoLog,
        valor_anterior: { estado: prev },
        valor_nuevo: { estado: nuevoEstado },
        justificacion: justificacion!.trim(),
      },
    ]);
    if (e2) throw e2;
  }
}
