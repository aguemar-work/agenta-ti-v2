/**
 * lib/permisos.ts
 *
 * Reglas de permisos de UI (ocultar CTAs, readOnly en tarjetas).
 * La autorización real está en PostgreSQL: RLS + RPCs SECURITY DEFINER.
 * Ver matriz de paridad en `permisosBackend.ts` y tests `permisos.rls-paridad.test.ts`.
 *
 * Regla: si la lógica de "¿puede hacer X?" aparece en más de un hook o
 * componente, pertenece aquí — nunca confiar solo en el cliente.
 */

import { useWorkspaceStore } from '@/store/workspaceStore';
import type { Tarea, Usuario } from '@/types';

/**
 * Determina si el usuario puede gestionar (editar, completar,
 * reprogramar, eliminar) una tarea.
 *
 * Reglas:
 *   - El jefe puede gestionar cualquier tarea del equipo.
 *   - Un miembro solo puede gestionar las tareas que tiene asignadas.
 */
export function puedeGestionarTarea(
  tarea: Tarea,
  usuario: Pick<Usuario, 'id'> | null | undefined,
): boolean {
  if (!usuario) return false;
  if (useWorkspaceStore.getState().esJefe()) return true;
  return tarea.asignado_a === usuario.id;
}