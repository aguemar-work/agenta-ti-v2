import { getInsforge } from '@/lib/insforge';
import type { EstadoTarea } from '@/types';

/**
 * Mueve una tarea a un nuevo estado en el kanban.
 * Toda la validación (permisos, justificación, transiciones) ocurre en el
 * servidor a través del RPC `sgtd_mover_tarea_columna`.
 */
export async function moverTareaColumna(
  tareaId: string,
  nuevoEstado: EstadoTarea,
  usuarioActorId: string,
  justificacion?: string,
): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_mover_tarea_columna', {
    p_tarea_id:      tareaId,
    p_nuevo_estado:  nuevoEstado,
    p_usuario_id:    usuarioActorId,
    p_justificacion: justificacion ?? null,
  });
  if (error) throw error;
}
