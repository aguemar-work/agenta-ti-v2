import { useMemo, useState } from 'react';
import {
  Ban, CalendarClock, Check, ChevronsUp, ChevronsUpDown,
  ChevronUp, ChevronDown, Equal, Flame, MoreVertical, Play, Trash2,
} from 'lucide-react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { Button } from '@/components/ui/Button';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';
import { fechaLocalYmd } from '@/lib/fecha';
import { claveVisualTarea, estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { FiltroRapido } from '@/components/semana/MiSemanaToolbar';
import type { PrioridadTarea, Tarea } from '@/types';

const SIN_INICIAR_ESTADOS = ['pendiente', 'reprogramada', 'atrasada'] as const;
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const;
const DIAS_CORTO_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] as const;

const PRIO_ORDER: Record<PrioridadTarea, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
const PRIO_DOT: Record<PrioridadTarea, string> = {
  critica: 'mc-lista-prio--critica',
  alta:    'mc-lista-prio--alta',
  media:   'mc-lista-prio--media',
  baja:    'mc-lista-prio--baja',
};
const PRIO_CHIP: Record<PrioridadTarea, { icon: typeof Flame; clase: string; label: string } | null> = {
  critica: { icon: Flame,      clase: 'mc-chip--prioridad-critica', label: 'Crítica' },
  alta:    { icon: ChevronsUp, clase: 'mc-chip--prioridad-alta',    label: 'Alta'    },
  media:   { icon: Equal,      clase: 'mc-chip--prioridad-media',   label: 'Media'   },
  baja:    null,
};

type SortKey = 'prioridad' | 'titulo' | 'responsable' | 'estado' | 'area'
             | 'fecha_planificada' | 'created_at' | 'fecha_completada';
type SortDir = 'asc' | 'desc';

function formatFechaPlan(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return `${DIAS_CORTO_SEMANA[d.getDay()]} ${d.getDate()}`;
}

function formatFecha(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export type MiSemanaListaVistaProps = {
  diasSemana: Date[];
  hoyYmd: string;
  tareasPlan: Tarea[];
  filtroRapido: FiltroRapido | null;
  ordenesPorTarea: Map<string, OrdenTrabajo>;
  nombresPorId: Map<string, string>;
  areasPorId: Map<string, string>;
  puedeGestionar: (t: Tarea) => boolean;
  onAbrirDetalle: (tareaId: string) => void;
  completarPendingId?: string | null;
  iniciarPendingId?: string | null;
  onIniciarTarea?: (t: Tarea) => void;
  onCompletarTarea?: (t: Tarea) => void;
  onReprogramarTarea?: (t: Tarea) => void;
  onCancelarTarea?: (t: Tarea) => void;
  onEliminarTarea?: (t: Tarea) => void;
};

// ── Fila individual ────────────────────────────────────────────────────────
type FilaProps = {
  tarea: Tarea;
  hoyYmd: string;
  responsableNombre: string;
  areaNombre: string | undefined;
  gestiona: boolean;
  completandoEsta: boolean;
  iniciandoEsta: boolean;
  onAbrirDetalle: (id: string) => void;
  onIniciarTarea?: ((t: Tarea) => void) | undefined;
  onCompletarTarea?: ((t: Tarea) => void) | undefined;
  onReprogramarTarea?: ((t: Tarea) => void) | undefined;
  onCancelarTarea?: ((t: Tarea) => void) | undefined;
  onEliminarTarea?: ((t: Tarea) => void) | undefined;
};

function ListaFila({
  tarea, hoyYmd, responsableNombre, areaNombre, gestiona,
  completandoEsta, iniciandoEsta, onAbrirDetalle,
  onIniciarTarea, onCompletarTarea, onReprogramarTarea,
  onCancelarTarea, onEliminarTarea,
}: FilaProps) {
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const clave = claveVisualTarea(tarea, hoyYmd);
  const terminal = tarea.estado === 'completada' || tarea.estado === 'cancelada';

  const puedeIniciar     = gestiona && tarea.estado === 'pendiente' && Boolean(onIniciarTarea);
  const puedeCompletar   = gestiona && tarea.estado === 'en_progreso' && Boolean(onCompletarTarea);
  const puedeReprogramar = gestiona && !terminal && Boolean(onReprogramarTarea) &&
    ['pendiente','atrasada','reprogramada','en_progreso'].includes(clave);
  const puedeCancelar    = gestiona && !terminal && Boolean(onCancelarTarea) &&
    ['pendiente','en_progreso'].includes(tarea.estado);
  const puedeEliminar    = gestiona && !terminal && Boolean(onEliminarTarea);

  const menuItems = useMemo((): PopoverMenuItem[] => {
    const items: PopoverMenuItem[] = [];
    if (puedeReprogramar && onReprogramarTarea)
      items.push({ id: 'reprogramar', label: 'Reprogramar', icon: CalendarClock, onClick: () => onReprogramarTarea(tarea) });
    if (puedeCancelar && onCancelarTarea)
      items.push({ id: 'cancelar', label: 'Cancelar tarea', icon: Ban, onClick: () => onCancelarTarea(tarea) });
    if (puedeEliminar)
      items.push({ id: 'eliminar', label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setConfirmarEliminar(true) });
    return items;
  }, [tarea, puedeReprogramar, onReprogramarTarea, puedeCancelar, onCancelarTarea, puedeEliminar]);

  const chip = PRIO_CHIP[tarea.prioridad];

  return (
    <>
      <tr
        className={[
          'mc-lista-tr',
          terminal      ? 'mc-lista-tr--terminal' : '',
          clave === 'atrasada' ? 'mc-lista-tr--atrasada' : '',
        ].filter(Boolean).join(' ')}
      >
        {/* Prioridad */}
        <td className="mc-lista-td mc-lista-td--prio">
          <div className="mc-lista-prio-cell">
            <span className={`mc-lista-prio-dot ${PRIO_DOT[tarea.prioridad]}`} aria-hidden />
            {chip && (
              <span className={`mc-chip ${chip.clase}`} title={chip.label}>
                <chip.icon size={11} aria-hidden /> {chip.label}
              </span>
            )}
          </div>
        </td>

        {/* Tarea */}
        <td className="mc-lista-td mc-lista-td--titulo">
          <button
            type="button"
            className="mc-lista-titulo-btn"
            onClick={() => onAbrirDetalle(tarea.id)}
          >
            {tarea.titulo}
          </button>
        </td>

        {/* Responsable */}
        <td className="mc-lista-td mc-lista-td--meta">
          <span className="mc-lista-meta-txt">{responsableNombre}</span>
        </td>

        {/* Estado */}
        <td className="mc-lista-td mc-lista-td--meta">
          <TareaEstadoIndicator estado={clave} variant="pill" />
        </td>

        {/* Área */}
        <td className="mc-lista-td mc-lista-td--meta">
          {areaNombre
            ? <span className="mc-chip mc-chip--area">{areaNombre}</span>
            : <span className="mc-lista-meta-vacio">—</span>}
        </td>

        {/* Fecha planificada */}
        <td className="mc-lista-td mc-lista-td--fecha">
          <span className="mc-lista-meta-txt">{formatFechaPlan(tarea.fecha_planificada)}</span>
        </td>

        {/* Creación */}
        <td className="mc-lista-td mc-lista-td--fecha">
          <span className="mc-lista-meta-txt">{formatFecha(tarea.created_at)}</span>
        </td>

        {/* Completada */}
        <td className="mc-lista-td mc-lista-td--fecha">
          <span className="mc-lista-meta-txt">{formatFecha(tarea.fecha_completada)}</span>
        </td>

        {/* Acciones */}
        <td className="mc-lista-td mc-lista-td--acciones" onClick={(e) => e.stopPropagation()}>
          <div className="mc-lista-actions">
            {puedeIniciar && (
              <Button variant="primary" size="xs" loading={iniciandoEsta} onClick={() => onIniciarTarea!(tarea)}>
                <Play size={11} aria-hidden /> Iniciar
              </Button>
            )}
            {puedeCompletar && (
              <Button variant="primary" size="xs" loading={completandoEsta} onClick={() => onCompletarTarea!(tarea)}>
                <Check size={11} aria-hidden /> Completar
              </Button>
            )}
            {menuItems.length > 0 && (
              <PopoverMenu
                items={menuItems}
                trigger={
                  <button type="button" className="mc-lista-fila__menu-btn" aria-label="Más acciones">
                    <MoreVertical size={15} aria-hidden />
                  </button>
                }
              />
            )}
          </div>
        </td>
      </tr>

      <ModalConfirmar
        open={confirmarEliminar}
        titulo="Eliminar tarea"
        mensaje="Se abrirá el formulario para indicar el motivo. ¿Continuar?"
        labelConfirmar="Sí, eliminar tarea"
        variantConfirmar="danger"
        analyticsId="modal-confirmar-eliminar-lista"
        onCancelar={() => setConfirmarEliminar(false)}
        onConfirmar={() => { setConfirmarEliminar(false); onEliminarTarea?.(tarea); }}
      />
    </>
  );
}

// ── Cabecera de columna ordenable ──────────────────────────────────────────
function Th({
  label, sortKey: key, current, dir,
  onSort, align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = current === key;
  return (
    <th
      className={`mc-lista-th mc-lista-th--sort${active ? ' mc-lista-th--active' : ''}`}
      style={{ textAlign: align }}
    >
      <button type="button" className="mc-lista-th-btn" onClick={() => onSort(key)}>
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />)
          : <ChevronsUpDown size={12} aria-hidden className="mc-lista-th-btn__unsorted" />}
      </button>
    </th>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function MiSemanaListaVista({
  diasSemana,
  hoyYmd,
  tareasPlan,
  filtroRapido,
  nombresPorId,
  areasPorId,
  puedeGestionar,
  onAbrirDetalle,
  completarPendingId,
  iniciarPendingId,
  onIniciarTarea,
  onCompletarTarea,
  onReprogramarTarea,
  onCancelarTarea,
  onEliminarTarea,
}: MiSemanaListaVistaProps) {
  const [sortKey, setSortKey] = useState<SortKey>('fecha_planificada');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const tareasFiltradas = useMemo(() => {
    const ymds = new Set(diasSemana.map((d) => fechaLocalYmd(d)));
    let base = tareasPlan.filter(
      (t) => t.fecha_planificada !== null && ymds.has(t.fecha_planificada) && !t.es_imprevisto,
    );
    if (filtroRapido === 'sin_iniciar')
      base = base.filter((t) => (SIN_INICIAR_ESTADOS as readonly string[]).includes(estadoEfectivoTablero(t, hoyYmd)));
    if (filtroRapido === 'atrasada')
      base = base.filter((t) => estadoEfectivoTablero(t, hoyYmd) === 'atrasada');
    if (filtroRapido === 'critica')
      base = base.filter((t) => t.prioridad === 'critica');
    return base;
  }, [diasSemana, tareasPlan, filtroRapido, hoyYmd]);

  const tareasSorted = useMemo(() => {
    return [...tareasFiltradas].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'prioridad':         cmp = PRIO_ORDER[a.prioridad] - PRIO_ORDER[b.prioridad]; break;
        case 'titulo':            cmp = a.titulo.localeCompare(b.titulo, 'es'); break;
        case 'responsable':       cmp = (nombresPorId.get(a.asignado_a) ?? '').localeCompare(nombresPorId.get(b.asignado_a) ?? '', 'es'); break;
        case 'estado':            cmp = a.estado.localeCompare(b.estado); break;
        case 'area':              cmp = (a.area_id ? areasPorId.get(a.area_id) ?? '' : '').localeCompare(b.area_id ? areasPorId.get(b.area_id) ?? '' : '', 'es'); break;
        case 'fecha_planificada': cmp = (a.fecha_planificada ?? '').localeCompare(b.fecha_planificada ?? ''); break;
        case 'created_at':        cmp = a.created_at.localeCompare(b.created_at); break;
        case 'fecha_completada':  cmp = (a.fecha_completada ?? '').localeCompare(b.fecha_completada ?? ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tareasFiltradas, sortKey, sortDir, nombresPorId, areasPorId]);

  return (
    <div className="mc-semana-lista min-h-0 flex-1 overflow-auto rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
      {tareasFiltradas.length === 0 ? (
        <p className="mc-semana-lista__vacio">Sin tareas esta semana</p>
      ) : (
        <table className="mc-lista-tabla" role="grid">
          <thead className="mc-lista-thead">
            <tr>
              <Th label="Prioridad"   sortKey="prioridad"         current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Tarea"       sortKey="titulo"            current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Responsable" sortKey="responsable"       current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Estado"      sortKey="estado"            current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Área"        sortKey="area"              current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Fecha"       sortKey="fecha_planificada" current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Creación"    sortKey="created_at"        current={sortKey} dir={sortDir} onSort={handleSort} />
              <Th label="Completada"  sortKey="fecha_completada"  current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="mc-lista-th mc-lista-th--acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tareasSorted.map((t) => (
              <ListaFila
                key={t.id}
                tarea={t}
                hoyYmd={hoyYmd}
                responsableNombre={nombresPorId.get(t.asignado_a) ?? '—'}
                areaNombre={t.area_id ? areasPorId.get(t.area_id) : undefined}
                gestiona={puedeGestionar(t)}
                completandoEsta={completarPendingId === t.id}
                iniciandoEsta={iniciarPendingId === t.id}
                onAbrirDetalle={onAbrirDetalle}
                onIniciarTarea={onIniciarTarea}
                onCompletarTarea={onCompletarTarea}
                onReprogramarTarea={onReprogramarTarea}
                onCancelarTarea={onCancelarTarea}
                onEliminarTarea={onEliminarTarea}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
