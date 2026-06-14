/**
 * Helpers para mensajes de toast con vocabulario y formato consistentes.
 *
 * Patrones canónicos:
 *   Éxito:  "[Entidad] [participio]"          → "Tarea creada", "OT aprobada"
 *   Error:  "No se pudo [verbo] [entidad]."   → "No se pudo crear la tarea."
 *
 * Uso:
 *   import { toastOk, toastErr } from '@/lib/toast';
 *
 *   onSuccess: () => toastOk('Tarea creada'),
 *   onError:   (err) => toastErr('No se pudo crear la tarea', err),
 */

import { toast } from 'sonner';

/** Muestra un toast de éxito. Usar formato «[Entidad] [participio]». */
export function toastOk(mensaje: string): void {
  toast.success(mensaje);
}

/**
 * Muestra un toast de error y registra en consola.
 * Añade punto final si falta. Usar formato «No se pudo [verbo] [entidad]».
 */
export function toastErr(mensaje: string, err?: unknown): void {
  const texto = mensaje.endsWith('.') ? mensaje : `${mensaje}.`;
  if (err !== undefined) console.error(`[toast] ${mensaje}`, err);
  toast.error(texto);
}
