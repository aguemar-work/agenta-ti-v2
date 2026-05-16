import { AlertTriangle, Lock, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'mc-misemana-resumen-dismissed';

type Props = {
  pendientesHoy: number;
  atrasadas: number;
  bloqueadas: number;
};

export function MiSemanaResumenDia({ pendientesHoy, atrasadas, bloqueadas }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(sessionStorage.getItem(DISMISS_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;
  if (pendientesHoy === 0 && atrasadas === 0 && bloqueadas === 0) return null;

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  return (
    <div className="mc-misemana-resumen" role="status">
      <div className="mc-misemana-resumen__items">
        {pendientesHoy > 0 && (
          <span className="mc-misemana-resumen__item">
            <strong>{pendientesHoy}</strong> pendiente{pendientesHoy !== 1 ? 's' : ''} hoy
          </span>
        )}
        {atrasadas > 0 && (
          <span className="mc-misemana-resumen__item mc-misemana-resumen__item--alert">
            <AlertTriangle size={14} aria-hidden />
            <strong>{atrasadas}</strong> atrasada{atrasadas !== 1 ? 's' : ''}
          </span>
        )}
        {bloqueadas > 0 && (
          <span className="mc-misemana-resumen__item">
            <Lock size={14} aria-hidden />
            <strong>{bloqueadas}</strong> bloqueo{bloqueadas !== 1 ? 's' : ''} activo{bloqueadas !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <button
        type="button"
        className="mc-misemana-resumen__close"
        onClick={dismiss}
        aria-label="Ocultar resumen del día"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
