/**
 * components/ui/Modal.tsx
 * Componente Modal atómico reutilizable.
 *
 * Resuelve hallazgos 2.2 y 5.8:
 *   - Trap de foco (WCAG 2.1 AA 2.1.2): el foco no escapa al overlay.
 *   - Cierre con Escape.
 *   - aria-labelledby + aria-modal para screen readers.
 *   - Scroll lock en body mientras está abierto.
 *   - Animación de entrada suave.
 *
 * Uso básico:
 *   <Modal open={open} onClose={onClose} title="Bloquear tarea">
 *     <p>Contenido del modal</p>
 *   </Modal>
 */

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Oculta visualmente el título pero lo mantiene para screen readers */
  hideTitle?: boolean;
  size?: ModalSize;
  children: ReactNode;
  /** Acciones del footer (botones de confirm/cancel) */
  footer?: ReactNode;
}

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
}: ModalProps) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const dialogRef   = useRef<HTMLDivElement>(null);
  const titleId     = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  // ── Scroll lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ── Focus: mover al dialog al abrir ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (first ?? el).focus();
  }, [open]);

  // ── Escape ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Focus trap ────────────────────────────────────────────────────────────
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  // ── Click en overlay cierra ───────────────────────────────────────────────
  function handleOverlayClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="mc-overlay"
      role="presentation"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
        animation: 'mc-fade-in 0.15s ease',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`mc-modal ${sizeMap[size]}`}
        style={{
          width: '100%',
          background: 'var(--mc-color-surface)',
          border: '1px solid var(--mc-color-border)',
          borderRadius: 'var(--mc-radius-lg, 12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          outline: 'none',
          animation: 'mc-slide-up 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--mc-color-border)',
            flexShrink: 0,
          }}
        >
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 'var(--mc-text-md, 15px)',
              fontWeight: 600,
              color: 'var(--mc-color-text)',
              ...(hideTitle ? {
                position: 'absolute', width: '1px', height: '1px',
                padding: 0, margin: '-1px', overflow: 'hidden',
                clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0,
              } : {}),
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '6px',
              color: 'var(--mc-color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s',
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--mc-color-text)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover, rgba(0,0,0,0.06))';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--mc-color-text-secondary)';
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--mc-color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}