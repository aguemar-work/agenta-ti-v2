/**
 * components/semana/ModalAtrasadas.tsx
 *
 * Modal que lista todas las tareas atrasadas.
 * Cada fila tiene: título + fecha original + botones Reprogramar / Bloquear / Eliminar (jefe).
 * No hay "reprogramar todo" — cada tarea se gestiona individualmente.
 */

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Tarea } from '@/types';

interface ModalAtrasadasProps {
  atrasadas:    Tarea[];
  esJefe:       boolean;
  onReprogramar:(t: Tarea) => void;
  onBloquear:   (t: Tarea) => void;
  onEliminar?:  (t: Tarea) => void;
  onClose:      () => void;
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
      <p style={{ fontSize: 12, color: 'var(--mc-color-text-secondary)', margin: '0 0 12px' }}>
        {atrasadas.length} tarea{atrasadas.length > 1 ? 's' : ''} sin resolver de días anteriores
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {atrasadas.map((t) => (
          <div
            key={t.id}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:            10,
              padding:       '10px 12px',
              borderRadius:  'var(--mc-radius-md)',
              border:        '0.5px solid #F7C1C1',
              background:    '#FCEBEB',
            }}
          >
            {/* Indicador */}
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#E24B4A', flexShrink: 0, display: 'inline-block',
            }} />

            {/* Contenido */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 600, color: '#791F1F',
                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t.titulo}
              </p>
              {t.fecha_planificada && (
                <p style={{ fontSize: 11, color: '#A32D2D', margin: '1px 0 0' }}>
                  Planificada para{' '}
                  {new Date(`${t.fecha_planificada}T12:00:00`).toLocaleDateString('es', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                  {t.prioridad === 'alta' && ' · Alta prioridad'}
                </p>
              )}
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReprogramar(t)}
              >
                Reprogramar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onBloquear(t)}
              >
                Bloquear
              </Button>
              {esJefe && onEliminar && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onEliminar(t)}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer informativo */}
      <div style={{
        marginTop:    16,
        paddingTop:   12,
        borderTop:   '0.5px solid var(--mc-color-border)',
        fontSize:     11,
        color:        'var(--mc-color-text-secondary)',
        lineHeight:    1.5,
      }}>
        Reprogramar requiere justificación. Bloquear indica que hay un impedimento externo.
        {esJefe && ' Eliminar es permanente.'}
      </div>
    </Modal>
  );
}