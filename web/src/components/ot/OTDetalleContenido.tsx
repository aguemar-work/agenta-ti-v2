import { useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import {
  ESTADO_OT_BADGE,
  ESTADO_OT_LABEL,
  MODALIDAD_OT_LABEL,
  PRIORIDAD_OT_BADGE,
  PRIORIDAD_OT_LABEL,
} from '@/lib/otConfig';
import { otVencida } from '@/lib/otHelpers';
import type { OTDetalleAcciones } from '@/lib/otDetalleAcciones';

export type { OTDetalleAcciones };

function OTCampo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="mc-ot-detalle-campo">
      <span className="mc-ot-detalle-campo__label">{label}</span>
      <span className="mc-ot-detalle-campo__valor">{valor}</span>
    </div>
  );
}

function OTSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mc-ot-detalle-seccion">
      <p className="mc-ot-detalle-seccion__titulo">{titulo}</p>
      <div className="mc-ot-detalle-seccion__body">{children}</div>
    </section>
  );
}

function OTSeccionColapsable({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="mc-ot-detalle-seccion">
      <button
        type="button"
        className="mc-ot-detalle-seccion__toggle"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="mc-ot-detalle-seccion__titulo">{titulo}</span>
        <ChevronDown
          size={12}
          aria-hidden
          className={abierto ? 'mc-ot-detalle-seccion__chevron--open' : 'mc-ot-detalle-seccion__chevron'}
        />
      </button>
      {abierto ? <div className="mc-ot-detalle-seccion__body">{children}</div> : null}
    </section>
  );
}

type Props = {
  ot: OrdenTrabajo;
  hoy: string;
  acciones: OTDetalleAcciones;
};

export function OTDetalleContenido({ ot, hoy, acciones }: Props) {
  const vencida = otVencida(ot, hoy);

  return (
    <div className="mc-ot-detalle flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`mc-badge ${ESTADO_OT_BADGE[ot.estado]}`} style={{ fontSize: 10 }}>
          {ESTADO_OT_LABEL[ot.estado]}
        </span>
        {ot.prioridad === 'urgente' && (
          <span className={`mc-badge ${PRIORIDAD_OT_BADGE.urgente}`} style={{ fontSize: 10 }}>
            {PRIORIDAD_OT_LABEL.urgente}
          </span>
        )}
        <span className="mc-badge mc-badge-neutral" style={{ fontSize: 10 }}>
          {MODALIDAD_OT_LABEL[ot.modalidad]}
        </span>
      </div>

      {vencida && (
        <div className="mc-ot-detalle-alerta mc-ot-detalle-alerta--vencida">
          <AlertTriangle size={14} aria-hidden />
          <p>Fecha estimada vencida — requiere atención</p>
        </div>
      )}

      {ot.motivo_rechazo && (
        <div className="mc-ot-detalle-alerta mc-ot-detalle-alerta--rechazo">
          <p className="mc-ot-detalle-alerta__titulo">Motivo de rechazo</p>
          <p className="m-0 text-xs">{ot.motivo_rechazo}</p>
        </div>
      )}

      <OTSeccion titulo="Información general">
        <OTCampo label="Solicitado por" valor={ot.creador?.nombre ?? '—'} />
        <OTCampo label="Área destino" valor={ot.area_destino} />
        <OTCampo label="Tipo de trabajo" valor={ot.tipo_trabajo?.nombre ?? '—'} />
        <OTCampo label="Descripción" valor={ot.descripcion} />
        <OTCampo label="Fecha estimada" valor={ot.fecha_estimada} />
        {ot.tarea?.titulo ? <OTCampo label="Tarea vinculada" valor={ot.tarea.titulo} /> : null}
        {ot.objetivo?.titulo ? <OTCampo label="Objetivo vinculado" valor={ot.objetivo.titulo} /> : null}
      </OTSeccion>

      <OTSeccionColapsable titulo="Detalles técnicos">
        <OTCampo label="Ubicación" valor={ot.ubicacion ?? '—'} />
        <OTCampo label="Hora inicio" valor={ot.hora_inicio_est ?? '—'} />
        <OTCampo label="Duración estimada" valor={ot.duracion_est_min ? `${ot.duracion_est_min} min` : '—'} />
        <OTCampo label="Equipos/materiales" valor={ot.equipos_materiales ?? '—'} />
        <OTCampo label="Observaciones" valor={ot.observaciones ?? '—'} />
      </OTSeccionColapsable>

      {ot.estado === 'completada' && (
        <OTSeccion titulo="Datos del receptor">
          <OTCampo label="Nombre" valor={ot.receptor_nombre ?? '—'} />
          <OTCampo label="DNI" valor={ot.receptor_dni ?? '—'} />
          <OTCampo label="Cargo" valor={ot.receptor_cargo ?? '—'} />
        </OTSeccion>
      )}

      <div className="mc-ot-detalle-acciones flex flex-col gap-2 border-t border-[var(--mc-color-border)] pt-3">
        {acciones.puedeAprobar && (
          <Button variant="primary" size="sm" fullWidth loading={acciones.aprobarPending} onClick={acciones.onAprobar}>
            Aprobar
          </Button>
        )}
        {acciones.puedeCompletar && (
          <Button variant="primary" size="sm" fullWidth onClick={acciones.onCompletar}>
            Completar OT
          </Button>
        )}
        {acciones.puedeImprimir && (
          <Button variant="secondary" size="sm" fullWidth onClick={acciones.onImprimir}>
            Imprimir
          </Button>
        )}
        {acciones.puedeEditar && (
          <Button variant="secondary" size="sm" fullWidth onClick={acciones.onEditar}>
            Editar
          </Button>
        )}
        {(acciones.puedeCancelar || acciones.puedeRechazar) && (
          <div className="mc-danger-zone flex flex-col gap-2">
            {acciones.puedeCancelar && (
              <Button variant="danger" size="sm" fullWidth onClick={acciones.onCancelar}>
                Cancelar OT
              </Button>
            )}
            {acciones.puedeRechazar && (
              <Button variant="danger" size="sm" fullWidth onClick={acciones.onRechazar}>
                Rechazar
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
