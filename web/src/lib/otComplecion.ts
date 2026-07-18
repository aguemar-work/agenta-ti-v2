/**
 * Cierre de OT — validación de receptor.
 *
 * La migración 028 (CHECK ck_ot_completada_tiene_receptor) está aplicada en
 * todos los entornos, por lo que la validación es incondicional. El flag
 * VITE_OT_MIGRATION_028 que la condicionaba se eliminó (auditoría 2026-07-17,
 * A2: se apagaba en silencio si el .env no definía la variable).
 */

/** Mínimo para habilitar el botón "Confirmar cierre" (UI + RPC migr. 036). */
export function puedeCompletarOTReceptor(
  receptorNombre: string,
  receptorDni: string,
): boolean {
  const dni = receptorDni.trim();
  return receptorNombre.trim().length > 0 && /^[0-9]{8}$/.test(dni);
}

/** Regla de integridad al parsear filas desde la BD (espejo del CHECK de 028). */
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
