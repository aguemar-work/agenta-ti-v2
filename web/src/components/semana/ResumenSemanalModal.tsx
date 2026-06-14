import { useState } from 'react';
import { CalendarClock, Check, Loader2 } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { fechaLocalDdMmYyyy, parseYmdLocal } from '@/lib/fecha';
import type { Tarea } from '@/types';

type Props = {
  open: boolean;
  tareasPlan: Tarea[];
  proximoLunes: string; // "YYYY-MM-DD"
  onClose: () => void;
  onReprogramarTarea: (tareaId: string, fecha: string) => Promise<void>;
};

export function ResumenSemanalModal({
  open,
  tareasPlan,
  proximoLunes,
  onClose,
  onReprogramarTarea,
}: Props) {
  const [reprogramandoId,    setReprogramandoId]    = useState<string | null>(null);
  const [reprogramandoTodas, setReprogramandoTodas] = useState(false);

  const tareasActivas = tareasPlan.filter((t) => !t.es_imprevisto);
  const completadas   = tareasActivas.filter((t) => t.estado === 'completada');
  const pendientes    = tareasActivas.filter(
    (t) => t.estado !== 'completada' && t.estado !== 'cancelada',
  );
  const porcentaje = tareasActivas.length > 0
    ? Math.round((completadas.length / tareasActivas.length) * 100)
    : 100;

  const proximoLunesLabel = fechaLocalDdMmYyyy(parseYmdLocal(proximoLunes));
  const busy = reprogramandoTodas || reprogramandoId !== null;

  async function reprogramarUna(tareaId: string) {
    setReprogramandoId(tareaId);
    try { await onReprogramarTarea(tareaId, proximoLunes); }
    finally { setReprogramandoId(null); }
  }

  async function reprogramarTodas() {
    setReprogramandoTodas(true);
    try {
      for (const t of pendientes) {
        await onReprogramarTarea(t.id, proximoLunes);
      }
      onClose();
    } finally {
      setReprogramandoTodas(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resumen de la semana"
      analyticsId="modal-resumen-semanal"
      size="sm"
      footerClassName="mc-modal-footer--stack"
      footer={
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendientes.length > 0 ? (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={reprogramandoTodas}
                disabled={busy}
                onClick={() => void reprogramarTodas()}
              >
                <CalendarClock size={15} aria-hidden />
                Reprogramar todas al {proximoLunesLabel}
              </Button>
              <Button variant="ghost" size="md" fullWidth onClick={onClose} disabled={busy}>
                Cerrar sin reprogramar
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" fullWidth onClick={onClose}>
              ¡A la siguiente semana!
            </Button>
          )}
        </div>
      }
    >
      <div className="mc-resumen-semanal">

        {/* KPIs */}
        <div className="mc-resumen-semanal__kpis">
          <div className="mc-resumen-semanal__kpi mc-resumen-semanal__kpi--ok">
            <span className="mc-resumen-semanal__kpi-num">{completadas.length}</span>
            <span className="mc-resumen-semanal__kpi-lbl">completadas</span>
          </div>
          <div className="mc-resumen-semanal__kpi">
            <span className="mc-resumen-semanal__kpi-num">{pendientes.length}</span>
            <span className="mc-resumen-semanal__kpi-lbl">pendientes</span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div
          className="mc-resumen-semanal__barra-wrap"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${porcentaje}% de la semana completado`}
        >
          <div className="mc-resumen-semanal__barra">
            <div
              className="mc-resumen-semanal__barra-fill"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <span className="mc-resumen-semanal__pct">{porcentaje}%</span>
        </div>

        {/* Lista de pendientes / estado perfecto */}
        {pendientes.length > 0 ? (
          <div className="mc-resumen-semanal__pendientes">
            <p className="mc-resumen-semanal__seccion-titulo">Sin completar</p>
            <ul className="mc-resumen-semanal__lista">
              {pendientes.map((t) => (
                <li key={t.id} className="mc-resumen-semanal__item">
                  <span className="mc-resumen-semanal__item-titulo">{t.titulo}</span>
                  <button
                    type="button"
                    className="mc-resumen-semanal__item-btn"
                    disabled={busy}
                    onClick={() => void reprogramarUna(t.id)}
                    title={`Mover al ${proximoLunesLabel}`}
                    aria-label={`Reprogramar "${t.titulo}" al ${proximoLunesLabel}`}
                  >
                    {reprogramandoId === t.id
                      ? <Loader2 size={13} className="mc-btn-spinner" aria-hidden />
                      : <CalendarClock size={13} aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mc-resumen-semanal__todo-ok">
            <span className="mc-resumen-semanal__todo-ok-icon" aria-hidden>
              <Check size={32} strokeWidth={2.5} />
            </span>
            <p className="mc-resumen-semanal__todo-ok-txt">¡Semana perfecta!</p>
            <p className="mc-resumen-semanal__todo-ok-sub">
              Completaste todas las tareas de la semana.
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}
