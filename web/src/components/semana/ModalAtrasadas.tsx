/**
 * components/semana/ModalAtrasadas.tsx
 *
 * Lista tareas atrasadas con acciones por fila.
 *
 * Cambios V4:
 *   - Colores hardcodeados reemplazados por tokens CSS (dark mode safe)
 *   - Eliminar usa ghost con color danger (no danger sólido)
 *   - Prioridad usa PRIORIDAD_BADGE del design system
 */

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PRIORIDAD_BADGE, PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import type { Tarea } from '@/types';

interface ModalAtrasadasProps {
  atrasadas:     Tarea[];
  esJefe:        boolean;
  onReprogramar: (t: Tarea) => void;
  onBloquear:    (t: Tarea) => void;
  onEliminar?:   (t: Tarea) => void;
  onClose:       () => void;
}

export function ModalAtrasadas({
  atrasadas, esJefe, onReprogramar, onBloquear, onEliminar, onClose,
}: ModalAtrasadasProps) {
  return (
    <Modal
      open={true}
      title="Tareas atrasadas"
      onClose={onClose}
    >
      <p className="text-xs text-[var(--mc-color-text-secondary)] mb-3">
        {atrasadas.length} tarea{atrasadas.length > 1 ? 's' : ''} sin resolver de días anteriores
      </p>

      <div className="flex flex-col gap-2">
        {atrasadas.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5"
            style={{
              border:     '0.5px solid var(--mc-state-atrasada-border)',
              background: 'var(--mc-state-atrasada-bg)',
            }}
          >
            {/* Indicador de color */}
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--mc-state-atrasada-border)',
                flexShrink: 0, marginTop: 5,
              }}
              aria-hidden
            />

            {/* Contenido */}
            <div className="flex flex-1 min-w-0 flex-col gap-1">
              <p
                className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                style={{ color: 'var(--mc-state-atrasada-fg)' }}
              >
                {t.titulo}
              </p>
              <div className="flex items-center gap-2">
                {t.fecha_planificada && (
                  <span className="text-[11px]" style={{ color: 'var(--mc-state-atrasada-meta)' }}>
                    {new Date(`${t.fecha_planificada}T12:00:00`).toLocaleDateString('es', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </span>
                )}
                <span className={`text-[10px] ${PRIORIDAD_BADGE[t.prioridad]}`}>
                  {PRIORIDAD_LABEL[t.prioridad]}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="secondary" size="sm" onClick={() => onReprogramar(t)}>
                Reprogramar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onBloquear(t)}>
                Bloquear
              </Button>
              {esJefe && onEliminar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEliminar(t)}
                  style={{ color: 'var(--mc-color-danger)', borderColor: 'var(--mc-color-danger)' }}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 pt-3 border-t border-[var(--mc-color-border)] text-[11px] text-[var(--mc-color-text-secondary)] leading-relaxed">
        Reprogramar requiere justificación. Bloquear indica un impedimento externo.
        {esJefe && ' Eliminar es permanente.'}
      </p>
    </Modal>
  );
}