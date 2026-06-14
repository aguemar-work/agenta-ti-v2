import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaHistorialSection } from '@/components/tareas/TareaHistorialSection';
import { TareaMetaPillRow } from '@/components/tareas/TareaMetaPillRow';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { labelNumeroOT } from '@/lib/otNumero';
import { textoEjesTarea } from '@/lib/tableroEstado';
import type { Objetivo, Tarea, Usuario } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables: Pick<Usuario, 'id' | 'nombre'>[];
  ot?: OrdenTrabajo | null;
  onOtClick?: (ot: OrdenTrabajo) => void;
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => (p[0] ?? '').toUpperCase())
    .slice(0, 2)
    .join('');
}

export function TareaDetalleVista({ tarea, hoyYmd, objetivos, usuariosAsignables, ot, onOtClick }: Props) {
  const responsableNombre =
    usuariosAsignables.find((x) => x.id === tarea.asignado_a)?.nombre ?? tarea.asignado_a;

  return (
    <div className="mc-tarea-detalle">
      <p className="mc-tarea-detalle__kicker">
        {textoEjesTarea(tarea, hoyYmd) ?? 'Tarea planificada'}
      </p>
      <h2 className="mc-tarea-detalle__titulo">{tarea.titulo}</h2>

      {tarea.descripcion?.trim() ? (
        <p className="mc-tarea-detalle__desc">{tarea.descripcion}</p>
      ) : (
        <p className="mc-tarea-detalle__desc mc-tarea-detalle__desc--empty">Sin descripción.</p>
      )}

      <TareaMetaPillRow tarea={tarea} hoyYmd={hoyYmd} />

      {ot && (
        <p className="mc-tarea-detalle__meta-line">
          OT vinculada:{' '}
          {onOtClick ? (
            <button type="button" className="mc-text-link" onClick={() => onOtClick(ot)}>
              {labelNumeroOT(ot.numero)} · {ESTADO_OT_LABEL[ot.estado]}
            </button>
          ) : (
            <span>{labelNumeroOT(ot.numero)} · {ESTADO_OT_LABEL[ot.estado]}</span>
          )}
        </p>
      )}

      {tarea.objetivo_id && (
        <p className="mc-tarea-detalle__meta-line">
          Objetivo:{' '}
          {objetivos.find((o) => o.id === tarea.objetivo_id)?.titulo ?? '—'}
        </p>
      )}

      <div className="mc-tarea-detalle__responsable">
        <span className="mc-tarea-detalle__avatar" aria-hidden>
          {iniciales(responsableNombre)}
        </span>
        <span>
          <span className="mc-tarea-detalle__responsable-nombre">{responsableNombre}</span>
          <span className="mc-tarea-detalle__responsable-rol">Responsable</span>
        </span>
      </div>

      <TareaHistorialSection tareaId={tarea.id} defaultOpen />
    </div>
  );
}
