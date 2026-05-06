/**
 * lib/permisos.ts
 *
 * Fuente única de verdad para reglas de permisos de UI.
 * Estas funciones son frontend-only: complementan las políticas RLS de BD
 * controlando qué CTAs y acciones se muestran al usuario.
 *
 * Regla: si la lógica de "¿puede hacer X?" aparece en más de un hook o
 * componente, pertenece aquí.
 */

import type { Tarea, Usuario } from '@/types';

/**
 * Determina si el usuario puede gestionar (editar, completar, bloquear,
 * reprogramar, eliminar) una tarea.
 *
 * Reglas:
 *   - El jefe puede gestionar cualquier tarea del equipo.
 *   - Un miembro solo puede gestionar las tareas que tiene asignadas.
 */
export function puedeGestionarTarea(
  tarea: Tarea,
  usuario: Pick<Usuario, 'id' | 'rol'> | null | undefined,
): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'jefe') return true;
  return tarea.asignado_a === usuario.id;
}