/**
 * components/ui/Modal.tsx
 *
 * Overlay y diálogo con clases del design system (`mc-modal-*`).
 * Si `hasUnsavedChanges`, pide confirmación antes de cerrar (X, Escape, click fuera).
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { trackModalClose, trackModalOpen } from '@/lib/analytics';

type ModalSize = 'sm' | 'md' | 'lg';
/** 0 = base · 1 = sobre otro modal · 2 = confirmaciones críticas encima de todo */
export type ModalStackLevel = 0 | 1 | 2;

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /** Clases extra del pie (p. ej. `mc-modal-footer--stack` para CTA a ancho completo). */
  footerClassName?: string;
  /** Clases extra del cuerpo (p. ej. `mc-modal-form` para altura de inputs unificada). */
  bodyClassName?: string;
  hasUnsavedChanges?: boolean;
  discardMessage?: string;
  /** Capa z-index cuando conviven varios overlays (p. ej. completar tras detalle). */
  stackLevel?: ModalStackLevel;
  /** Texto descriptivo enlazado con aria-describedby (recomendado en acciones destructivas). */
  description?: string;
  /** Si el cuerpo ya incluye la descripción visible, su id (evita párrafo duplicado). */
  descriptionElementId?: string;
  /** Id estable para analytics (modal_open / modal_close + abandono). */
  analyticsId?: string;
}

export { markModalCompleted } from '@/lib/analytics';

const STACK_OVERLAY_CLASS: Record<ModalStackLevel, string> = {
  0: '',
  1: 'mc-modal-overlay--stack',
  2: 'mc-modal-overlay--top',
};

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, ' +
  '[tabindex]:not([tabindex="-1"]), [contenteditable]';

export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  size = 'md',
  children,
  footer,
  footerClassName,
  bodyClassName,
  hasUnsavedChanges = false,
  discardMessage = '¿Descartar los cambios? Se perderá la información ingresada.',
  stackLevel = 0,
  description,
  descriptionElementId,
  analyticsId,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const generatedDescId = useId();
  const describedById = descriptionElementId ?? (description ? generatedDescId : undefined);

  const [confirmingClose, setConfirmingClose] = useState(false);

  function emitClose() {
    if (analyticsId) trackModalClose(analyticsId);
    onClose();
  }

  function tryClose() {
    if (hasUnsavedChanges) setConfirmingClose(true);
    else emitClose();
  }

  function confirmDiscard() {
    setConfirmingClose(false);
    emitClose();
  }

  function cancelDiscard() {
    setConfirmingClose(false);
    dialogRef.current?.focus();
  }

  useEffect(() => {
    if (!open || !analyticsId) return;
    trackModalOpen(analyticsId);
  }, [open, analyticsId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (first ?? el).focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (confirmingClose) cancelDiscard();
      else tryClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirmingClose, hasUnsavedChanges]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={['mc-modal-overlay', STACK_OVERLAY_CLASS[stackLevel]].filter(Boolean).join(' ')}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) tryClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(describedById ? { 'aria-describedby': describedById } : {})}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`mc-modal-dialog ${SIZE_CLASS[size]}`}
      >
        <div className="mc-modal-header">
          <div className="mc-modal-header-left">
            <h2
              id={titleId}
              className={
                hideTitle ? 'mc-modal-title mc-modal-title--sr-only' : 'mc-modal-title'
              }
            >
              {title}
            </h2>
            {hasUnsavedChanges && (
              <span
                className="mc-modal-unsaved-dot"
                title="Tienes cambios sin guardar"
                aria-label="Cambios sin guardar"
              />
            )}
          </div>
          <button
            type="button"
            className="mc-modal-close"
            onClick={tryClose}
            aria-label="Cerrar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={['mc-modal-body', bodyClassName].filter(Boolean).join(' ')}>
          {description && !descriptionElementId ? (
            <p id={generatedDescId} className="mc-modal-description">
              {description}
            </p>
          ) : null}
          {children}
        </div>

        {footer ? (
          <div className={['mc-modal-footer', footerClassName].filter(Boolean).join(' ')}>{footer}</div>
        ) : null}

        {confirmingClose && (
          <div
            className="mc-modal-confirm-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-title"
            aria-describedby="confirm-discard-desc"
          >
            <div className="mc-modal-confirm-card">
              <div>
                <p id="confirm-discard-title" className="mc-modal-confirm-title">
                  ¿Descartar cambios?
                </p>
                <p id="confirm-discard-desc" className="mc-modal-confirm-desc">{discardMessage}</p>
              </div>
              <div className="mc-modal-confirm-actions">
                <button
                  type="button"
                  autoFocus
                  onClick={cancelDiscard}
                  className="mc-btn-ghost"
                >
                  Seguir editando
                </button>
                <button type="button" onClick={confirmDiscard} className="mc-btn-danger">
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
