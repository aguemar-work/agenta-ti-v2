/**
 * lib/modalStack.ts
 *
 * Pila global de diálogos/overlays abiertos. Regla WAI-ARIA: Escape cierra
 * SOLO el diálogo superior. Antes cada Modal escuchaba `keydown` en document
 * y un Escape cerraba todos los apilados a la vez (auditoría 2026-07-17, A3).
 *
 * Uso: pushDialog() al abrir (guardar el token), popDialog(token) al cerrar,
 * y en el handler de Escape actuar solo si isTopDialog(token).
 */

export type DialogToken = symbol;

const stack: DialogToken[] = [];

export function pushDialog(): DialogToken {
  const token: DialogToken = Symbol('dialog');
  stack.push(token);
  return token;
}

export function popDialog(token: DialogToken | null): void {
  if (token === null) return;
  const i = stack.indexOf(token);
  if (i !== -1) stack.splice(i, 1);
}

export function isTopDialog(token: DialogToken | null): boolean {
  return token !== null && stack.length > 0 && stack[stack.length - 1] === token;
}

/** Selector compartido de elementos enfocables (Modal + useDialogA11y). */
export const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, ' +
  '[tabindex]:not([tabindex="-1"]), [contenteditable]';
