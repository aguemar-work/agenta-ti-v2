/** Etiqueta de número OT — borradores aún no tienen OT-TI-XXXX. */
export function labelNumeroOT(numero: string | null | undefined): string {
  if (numero?.trim()) return numero.trim();
  return 'Borrador';
}
