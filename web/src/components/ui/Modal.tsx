/**
 * components/ui/Modal.tsx
 *
 * Actualización: prop `hasUnsavedChanges`.
 * Si es true y el usuario intenta cerrar (X, Escape, click fuera),
 * muestra un diálogo de confirmación antes de descartar.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface ModalProps {
  open:    boolean;
  onClose: () => void;
  title:   string;
  hideTitle?: boolean;
  size?:   ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Si es true, pide confirmación antes de cerrar.
   * Conectar con useDraftForm: hasUnsavedChanges={hasChanges}
   */
  hasUnsavedChanges?: boolean;
  /** Texto personalizado del diálogo de confirmación */
  discardMessage?: string;
}

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, ' +
  '[tabindex]:not([tabindex="-1"]), [contenteditable]';

export function Modal({
  open, onClose, title, hideTitle = false, size = 'md',
  children, footer,
  hasUnsavedChanges = false,
  discardMessage = '¿Descartar los cambios? Se perderá la información ingresada.',
}: ModalProps) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const dialogRef   = useRef<HTMLDivElement>(null);
  const titleId     = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  // Estado del diálogo de confirmación
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Intentar cerrar — si hay cambios, pedir confirmación
  function tryClose() {
    if (hasUnsavedChanges) {
      setConfirmingClose(true);
    } else {
      onClose();
    }
  }

  function confirmDiscard() {
    setConfirmingClose(false);
    onClose();
  }

  function cancelDiscard() {
    setConfirmingClose(false);
    // Devolver foco al dialog
    dialogRef.current?.focus();
  }

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Focus al abrir
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (first ?? el).focus();
  }, [open]);

  // Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (confirmingClose) {
          cancelDiscard();
        } else {
          tryClose();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirmingClose, hasUnsavedChanges]);

  // Focus trap
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
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

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) tryClose();
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
        zIndex: 50, padding: '16px',
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
          display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          outline: 'none',
          animation: 'mc-slide-up 0.2s ease',
          position: 'relative',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--mc-color-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2
              id={titleId}
              style={{
                margin: 0, fontSize: 'var(--mc-text-md, 15px)', fontWeight: 600,
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
            {/* Indicador de cambios no guardados */}
            {hasUnsavedChanges && (
              <span
                title="Tienes cambios sin guardar"
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--mc-color-warning)',
                  display: 'inline-block', flexShrink: 0,
                }}
                aria-label="Cambios sin guardar"
              />
            )}
          </div>
          <button
            type="button"
            onClick={tryClose}
            aria-label="Cerrar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: '6px',
              color: 'var(--mc-color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s', lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--mc-color-text)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)';
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

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {footer && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--mc-color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            flexWrap: 'wrap',
            gap: '8px',
            flexShrink: 0,
          }}
          >
            {footer}
          </div>
        )}

        {/* ── Diálogo de confirmación (overlay interno) ───────────────── */}
        {confirmingClose && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 'var(--mc-radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, padding: 24,
              animation: 'mc-fade-in 0.1s ease',
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-title"
          >
            <div style={{
              background: 'var(--mc-color-surface)',
              border: '1px solid var(--mc-color-border)',
              borderRadius: 'var(--mc-radius-lg)',
              padding: '20px 24px',
              maxWidth: 320,
              width: '100%',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}>
              <div>
                <p id="confirm-discard-title" style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--mc-color-text)' }}>
                  ¿Descartar cambios?
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--mc-color-text-secondary)', lineHeight: 1.5 }}>
                  {discardMessage}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  autoFocus
                  onClick={cancelDiscard}
                  style={{
                    padding: '7px 16px', borderRadius: 'var(--mc-radius-md)',
                    border: '1px solid var(--mc-color-border-strong)',
                    background: 'var(--mc-color-surface)',
                    color: 'var(--mc-color-text)',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    transition: 'background 0.13s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface)'; }}
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={confirmDiscard}
                  style={{
                    padding: '7px 16px', borderRadius: 'var(--mc-radius-md)',
                    border: 'none',
                    background: 'var(--mc-color-danger)',
                    color: '#fff',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    transition: 'opacity 0.13s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                >
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