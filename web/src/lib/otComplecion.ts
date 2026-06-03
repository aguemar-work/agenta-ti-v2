/**
 * Cierre de OT — validación de receptor (migración 028).
 *
 * Tras ejecutar `db/migrations/028_check_ot_completada_receptor.sql` en InsForge,
 * activar en `.env`:
 *   VITE_OT_MIGRATION_028=true
 *
 * Con el flag en false (default), el parseo Zod de OT no exige receptor en completadas
 * (compatibilidad hasta que la migración esté en todos los entornos).
 */

export const OT_MIGRATION_028_APLICADA =
  import.meta.env.VITE_OT_MIGRATION_028 === 'true';

/** Mínimo para habilitar el botón "Confirmar cierre" (UI + RPC migr. 036). */
export function puedeCompletarOTReceptor(
  receptorNombre: string,
  receptorDni: string,
): boolean {
  const dni = receptorDni.trim();
  return receptorNombre.trim().length > 0 && /^[0-9]{8}$/.test(dni);
}

/** Regla de integridad al parsear filas desde la BD (solo si migración 028 activa en app). */
export function ordenTrabajoCompletadaTieneReceptor(ot: {
  estado: string;
  receptor_nombre: string | null;
  receptor_dni: string | null;
}): boolean {
  if (ot.estado !== 'completada') return true;
  return (
    Boolean(ot.receptor_nombre?.trim()) &&
    Boolean(ot.receptor_dni?.trim())
  );
}
