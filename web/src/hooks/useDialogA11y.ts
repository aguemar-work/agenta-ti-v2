/**
 * hooks/useDialogA11y.ts
 *
 * Accesibilidad mínima de un diálogo custom con role="dialog" aria-modal
 * que NO usa ui/Modal (drawers, vistas mobile a pantalla completa):
 *   - foco inicial al primer elemento enfocable (o al panel),
 *   - trap de Tab dentro del panel,
 *   - Escape cierra (solo si es el diálogo superior de la pila),
 *   - al cerrar, devuelve el foco al elemento que lo abrió.
 *
 * aria-modal="true" promete al lector de pantalla que el fondo es inerte;
 * sin esto el usuario de teclado "atraviesa" el diálogo (WCAG 2.1.2 / 2.4.3).
 */

import { useEffect, useRef, type RefObject } from 'react';

import { FOCUSABLE, isTopDialog, popDialog, pushDialog } from '@/lib/modalStack';

export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
) {
  // Latest-ref: evita re-registrar (y re-enfocar) si el padre pasa un onClose inline.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const token = pushDialog();
    const previo = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const primero = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (primero ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (!isTopDialog(token)) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;
      const el = panelRef.current;
      if (!el) return;
      const enfocables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (enfocables.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = enfocables[0];
      const last = enfocables[enfocables.length - 1];
      const activo = document.activeElement;
      const dentro = activo instanceof Node && el.contains(activo);
      if (e.shiftKey) {
        if (!dentro || activo === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (!dentro || activo === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      popDialog(token);
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [open, panelRef]);
}
