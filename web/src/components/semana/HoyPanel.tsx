/**
 * components/semana/HoyPanel.tsx
 *
 * Panel "Hoy" con:
 *  - Ordenamiento dinámico: urgentes primero, luego por prioridad
 *  - Alertas visuales horarias integradas en TaskItem
 *  - Mobile: tabs + orden urgente arriba
 *  - Desktop: 3 columnas lado a lado
 */

import { useMemo, useState } from 'react';

import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { STATE_TOKENS, TAREA_LABEL } from '@/lib/estadoConfig';
import { urgenciaHoraria } from '@/lib/tareaUrgencia';
import type { NotaBitacora, PrioridadTarea, Tarea } from '@/types';

type Tab = 'tareas' | 'incidencias' | 'bitacora';

interface HoyPanelProps {
  hoyYmd:               string;
  tareasPlan:           Tarea[];
  incidenciasHoy:       Tarea[];
  notasHoy:             NotaBitacora[];
  notaRapida:           string;
  setNotaRapida:        (v: string) => void;
  guardarNotaRapida:    () => Promise<void>;
  puedeGestionar:       (t: Tarea) => boolean;
  esJefe:               boolean;
  setDetalleTareaId:    (id: string) => void;
  setReprDetalleTarea:  (t: Tarea) => void;
  setBloquearTareaState:(t: Tarea) => void;
  setCompletarTareaId:  (id: string) => void;
  setModalInc:          (v: boolean) => void;
  onIniciarTarea:       (t: Tarea) => void | Promise<void>;
}

const PRIORIDAD_TXT: Record<PrioridadTarea, string> = {
  alta:  'Alta',
  media: 'Media',
  baja:  'Baja',
};

// ---------------------------------------------------------------------------
// Orden de urgencia para sorting (menor = más arriba)
// ---------------------------------------------------------------------------
const URGENCIA_ORDEN = { vencida_hoy: 0, urgente: 1, precaucion: 2, normal: 3 } as const;
const ESTADO_ORDEN   = { atrasada: 0, bloqueada: 1, en_progreso: 2, pendiente: 3, reprogramada: 4, completada: 5, cancelada: 6 } as const;
const PRIORIDAD_ORDEN = { alta: 0, media: 1, baja: 2 } as const;

function ordenarTareas(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    const ua = URGENCIA_ORDEN[urgenciaHoraria(a.estado)] ?? 3;
    const ub = URGENCIA_ORDEN[urgenciaHoraria(b.estado)] ?? 3;
    if (ua !== ub) return ua - ub;

    const ea = ESTADO_ORDEN[a.estado as keyof typeof ESTADO_ORDEN] ?? 5;
    const eb = ESTADO_ORDEN[b.estado as keyof typeof ESTADO_ORDEN] ?? 5;
    if (ea !== eb) return ea - eb;

    return (PRIORIDAD_ORDEN[a.prioridad] ?? 2) - (PRIORIDAD_ORDEN[b.prioridad] ?? 2);
  });
}

function tareasFocoYListas(hoyYmd: string, tareasPlan: Tarea[]): {
  foco:      Tarea | null;
  atrasadas: Tarea[];
  ordenadas: Tarea[];
} {
  const atrasadasRaw = tareasPlan.filter((t) => t.estado === 'atrasada');
  const delDiaRaw    = tareasPlan.filter((t) => t.fecha_planificada === hoyYmd && t.estado !== 'atrasada');
  const atrasadasOrd = ordenarTareas(atrasadasRaw);
  const ordenadasOrd = ordenarTareas(delDiaRaw);
  const candidato      = atrasadasOrd[0] ?? ordenadasOrd[0] ?? null;
  const foco =
    candidato && !['completada', 'cancelada'].includes(candidato.estado) ? candidato : null;
  return { foco, atrasadas: atrasadasOrd, ordenadas: ordenadasOrd };
}

// ---------------------------------------------------------------------------
// Hero: una sola acción primaria (Apple / SGTD)
// ---------------------------------------------------------------------------
function HoyFocoHero({
  tarea, puedeGestionar,
  setDetalleTareaId, setCompletarTareaId, onIniciarTarea,
  onReprogramar, onBloquear,
}: {
  tarea:                Tarea;
  puedeGestionar:       (t: Tarea) => boolean;
  setDetalleTareaId:    (id: string) => void;
  setCompletarTareaId:  (id: string) => void;
  onIniciarTarea:       (t: Tarea) => void | Promise<void>;
  onReprogramar?:       (t: Tarea) => void;
  onBloquear?:          (t: Tarea) => void;
}) {
  const gest = puedeGestionar(tarea);
  const est  = tarea.estado;
  const meta = `${TAREA_LABEL[est]} · Prioridad ${PRIORIDAD_TXT[tarea.prioridad]}`;

  const puedeIniciar   = gest && (est === 'pendiente' || est === 'atrasada' || est === 'reprogramada');
  const puedeCompletar = gest && est === 'en_progreso';
  const puedeRepr      = gest && ['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(est);
  const puedeBloq      = gest && ['pendiente', 'atrasada', 'en_progreso'].includes(est);

  return (
    <div className="px-2 pb-6 pt-1 md:px-3">
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--mc-color-text-secondary)' }}
      >
        Lo siguiente ahora
      </p>
      <h2
        className="mb-2 font-bold leading-tight tracking-tight text-[var(--mc-color-text)]"
        style={{ fontSize: 'clamp(1.375rem, 4vw, 1.75rem)' }}
      >
        {tarea.titulo}
      </h2>
      <p className="text-[13px] font-normal leading-normal text-[var(--mc-color-text-secondary)]">
        {meta}
      </p>
      <div className="mt-5 flex max-w-md flex-col gap-2 sm:flex-row sm:items-center">
        {puedeIniciar && (
          <Button size="lg" className="sm:min-w-[200px]" onClick={() => void onIniciarTarea(tarea)}>
            Iniciar tarea
          </Button>
        )}
        {puedeCompletar && (
          <Button size="lg" className="sm:min-w-[200px]" onClick={() => setCompletarTareaId(tarea.id)}>
            Completar
          </Button>
        )}
        <Button variant="quaternary" size="default" onClick={() => setDetalleTareaId(tarea.id)}>
          Ver detalle
        </Button>
      </div>
      {gest && (puedeRepr || puedeBloq) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {puedeRepr && onReprogramar && (
            <Button variant="secondary" size="sm" onClick={() => onReprogramar(tarea)}>
              Reprogramar
            </Button>
          )}
          {puedeBloq && onBloquear && (
            <Button variant="secondary" size="sm" onClick={() => onBloquear(tarea)}>
              Bloquear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columna Tareas
// ---------------------------------------------------------------------------
function ColTareas({
  hoyYmd, tareasPlan, focoId, puedeGestionar, esJefe,
  setDetalleTareaId, setReprDetalleTarea, setBloquearTareaState, setCompletarTareaId,
  onIniciarTarea,
}: Pick<HoyPanelProps, 'hoyYmd' | 'tareasPlan' | 'puedeGestionar' | 'esJefe' |
  'setDetalleTareaId' | 'setReprDetalleTarea' | 'setBloquearTareaState' | 'setCompletarTareaId' |
  'onIniciarTarea'> & { focoId: string | null }) {

  const { atrasadas: atrasadasOrd, ordenadas: ordenadasOrd } = tareasFocoYListas(hoyYmd, tareasPlan);
  const skip = (t: Tarea) => !focoId || t.id !== focoId;
  const atrasadas = atrasadasOrd.filter(skip);
  const ordenadas   = ordenadasOrd.filter(skip);

  if (atrasadasOrd.length === 0 && ordenadasOrd.length === 0) {
    return (
      <div className="mc-empty">
        <p className="mc-empty-title">Sin tareas para hoy</p>
        <p className="mc-empty-desc">
          {esJefe
            ? 'Planifica tareas para el equipo desde la vista Semana.'
            : 'No tienes tareas planificadas para hoy. Puedes registrar una incidencia si surge algo.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {atrasadas.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--mc-color-border)' }}>
          <div style={{
            background:     STATE_TOKENS.atrasada.bg,
            padding:        '6px 12px',
            fontSize:        11,
            fontWeight:      600,
            letterSpacing:  '.06em',
            textTransform:  'uppercase',
            color:          STATE_TOKENS.atrasada.meta,
            display:        'flex',
            alignItems:     'center',
            gap:             6,
          }}>
            <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:STATE_TOKENS.atrasada.border }} />
            {atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px' }}>
            {atrasadas.map((t) => (
              <TaskItem key={t.id} variant="week" tarea={t}
                esJefe={esJefe}
                readOnly={!puedeGestionar(t)}
                onOpenDetalle={() => setDetalleTareaId(t.id)}
                onReprogramar={puedeGestionar(t) ? (x) => setReprDetalleTarea(x) : undefined}
                onBloquear={puedeGestionar(t) ? (x) => setBloquearTareaState(x) : undefined}
                onCompletar={puedeGestionar(t) ? (x) => setCompletarTareaId(x.id) : undefined}
                onIniciar={puedeGestionar(t) ? (x) => void onIniciarTarea(x) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px' }}>
        {ordenadas.map((t) => (
          <TaskItem key={t.id} variant="week" tarea={t}
            esJefe={esJefe}
            readOnly={!puedeGestionar(t)}
            onOpenDetalle={() => setDetalleTareaId(t.id)}
            onReprogramar={puedeGestionar(t) ? (x) => setReprDetalleTarea(x) : undefined}
            onBloquear={puedeGestionar(t) ? (x) => setBloquearTareaState(x) : undefined}
            onCompletar={puedeGestionar(t) ? (x) => setCompletarTareaId(x.id) : undefined}
            onIniciar={puedeGestionar(t) ? (x) => void onIniciarTarea(x) : undefined}
          />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Columna Incidencias
// ---------------------------------------------------------------------------
function ColIncidencias({ incidenciasHoy, setModalInc }: Pick<HoyPanelProps, 'incidenciasHoy' | 'setModalInc'>) {
  const abiertas   = incidenciasHoy.filter((t) => t.estado !== 'completada' && t.estado !== 'cancelada');
  const cerradas   = incidenciasHoy.filter((t) => t.estado === 'completada' || t.estado === 'cancelada');

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 8px 8px', borderBottom:'1px solid var(--mc-color-border)' }}>
        <span style={{ fontSize:12, color:'var(--mc-color-text-secondary)' }}>
          {abiertas.length} pendiente{abiertas.length !== 1 ? 's' : ''} · {cerradas.length} resuelta{cerradas.length !== 1 ? 's' : ''}
        </span>
        <Button variant="quaternary" size="sm" onClick={() => setModalInc(true)}>
          + Incidencia
        </Button>
      </div>

      {incidenciasHoy.length === 0 ? (
        <div className="mc-empty">
          <p className="mc-empty-title">Sin incidencias hoy</p>
          <p className="mc-empty-desc">Registra imprevistos que surjan durante el día</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, padding:'8px' }}>
          {abiertas.map((t) => (
            <TaskItem key={t.id} variant="week" tarea={t} readOnly />
          ))}
          {cerradas.length > 0 && (
            <>
              <div style={{ fontSize:11, color:'var(--mc-color-text-secondary)', padding:'4px 0 0', fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase' }}>
                Resueltas
              </div>
              {cerradas.map((t) => (
                <TaskItem key={t.id} variant="week" tarea={t} readOnly />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Columna Bitácora
// ---------------------------------------------------------------------------
function ColBitacora({ notasHoy, notaRapida, setNotaRapida, guardarNotaRapida }: Pick<HoyPanelProps, 'notasHoy' | 'notaRapida' | 'setNotaRapida' | 'guardarNotaRapida'>) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, padding:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--mc-color-border)', paddingBottom:8 }}>
        <input
          className="mc-input flex-1"
          style={{ padding:'6px 10px', fontSize:13 }}
          placeholder="Nota rápida…"
          value={notaRapida}
          onChange={(e) => setNotaRapida(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardarNotaRapida(); } }}
        />
        <Button
          variant="quaternary"
          size="sm"
          disabled={!notaRapida.trim()}
          onClick={() => void guardarNotaRapida()}
          aria-label="Agregar nota"
        >
          Añadir
        </Button>
      </div>
      {notasHoy.length === 0 ? (
        <div className="mc-empty">
          <p className="mc-empty-title">Sin notas recientes</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {notasHoy.map((n) => (
            <div key={n.id} className="mc-entity-card">
              <span style={{ fontSize:11, color:'var(--mc-color-text-secondary)' }}>
                {new Date(n.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <p style={{ fontSize:13, color:'var(--mc-color-text)', margin:'2px 0 0' }}>{n.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HoyPanel principal
// ---------------------------------------------------------------------------
const TAB_CONFIG: { key: Tab; label: string; getCount?: (p: HoyPanelProps) => number }[] = [
  {
    key:      'tareas',
    label:    'Tareas',
    getCount: (p) => p.tareasPlan.filter((t) => !['completada','cancelada'].includes(t.estado)).length,
  },
  {
    key:      'incidencias',
    label:    'Incidencias',
    getCount: (p) => p.incidenciasHoy.filter((t) => t.estado !== 'completada').length,
  },
  { key: 'bitacora', label: 'Bitácora' },
];

export function HoyPanel(props: HoyPanelProps) {
  const [tabActivo, setTabActivo] = useState<Tab>('tareas');
  const { hoyYmd, tareasPlan, incidenciasHoy, notasHoy, notaRapida, setNotaRapida,
    guardarNotaRapida, puedeGestionar, esJefe, setDetalleTareaId, setReprDetalleTarea,
    setBloquearTareaState, setCompletarTareaId, setModalInc, onIniciarTarea } = props;

  const { foco } = useMemo(() => tareasFocoYListas(hoyYmd, tareasPlan), [hoyYmd, tareasPlan]);

  return (
    <>
      {/* ── Tabs mobile ─────────────────────────────────────────────────── */}
      <div className="md:hidden" style={{ display:'flex', borderBottom:'1px solid var(--mc-color-border)' }}>
        {TAB_CONFIG.map(({ key, label, getCount }) => {
          const count = getCount?.(props) ?? 0;
          const activo = tabActivo === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setTabActivo(key)}
              style={{
                flex:              1,
                padding:           '8px 4px',
                fontSize:          13,
                fontWeight:        activo ? 600 : 400,
                color:             activo ? 'var(--mc-color-accent)' : 'var(--mc-color-text-secondary)',
                borderBottom:      `2px solid ${activo ? 'var(--mc-color-accent)' : 'transparent'}`,
                background:        'none',
                border:            'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: activo ? 'var(--mc-color-accent)' : 'transparent',
                cursor:            'pointer',
                position:          'relative',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  justifyContent:'center',
                  width:         16,
                  height:        16,
                  borderRadius:  '50%',
                  background:    'var(--mc-color-danger)',
                  color:         '#fff',
                  fontSize:      10,
                  fontWeight:    700,
                  marginLeft:    4,
                  verticalAlign: 'middle',
                }}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Contenido: tab activo mobile / todas las cols desktop ───────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'tareas'}
        >
          <div className="mc-hoy-col-head hidden md:flex">
            <span>Tareas de hoy</span>
            {tareasPlan.filter((t) => t.estado === 'atrasada').length > 0 && (
              <span style={{ fontSize:11, fontWeight:600, color:STATE_TOKENS.atrasada.meta, background:STATE_TOKENS.atrasada.bg, padding:'2px 8px', borderRadius:20 }}>
                {tareasPlan.filter((t) => t.estado === 'atrasada').length} atrasada{tareasPlan.filter((t) => t.estado === 'atrasada').length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="mc-hoy-col-body">
            {foco && (
              <HoyFocoHero
                tarea={foco}
                puedeGestionar={puedeGestionar}
                setDetalleTareaId={setDetalleTareaId}
                setCompletarTareaId={setCompletarTareaId}
                onIniciarTarea={onIniciarTarea}
                onReprogramar={(t) => setReprDetalleTarea(t)}
                onBloquear={(t) => setBloquearTareaState(t)}
              />
            )}
            <ColTareas
              hoyYmd={hoyYmd}
              tareasPlan={tareasPlan}
              focoId={foco?.id ?? null}
              puedeGestionar={puedeGestionar}
              esJefe={esJefe}
              setDetalleTareaId={setDetalleTareaId}
              setReprDetalleTarea={setReprDetalleTarea}
              setBloquearTareaState={setBloquearTareaState}
              setCompletarTareaId={setCompletarTareaId}
              onIniciarTarea={onIniciarTarea}
            />
          </div>
        </section>

        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'incidencias'}
        >
          <div className="mc-hoy-col-head hidden md:flex">
            <span>Incidencias del día</span>
            <Button variant="quaternary" size="sm" onClick={() => setModalInc(true)}>
              + Incidencia
            </Button>
          </div>
          <div className="mc-hoy-col-body">
            <ColIncidencias incidenciasHoy={incidenciasHoy} setModalInc={setModalInc} />
          </div>
        </section>

        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'bitacora'}
        >
          <div className="mc-hoy-col-head hidden md:flex"><span>Bitácora rápida</span></div>
          <div className="mc-hoy-col-body">
            <ColBitacora
              notasHoy={notasHoy} notaRapida={notaRapida}
              setNotaRapida={setNotaRapida} guardarNotaRapida={guardarNotaRapida}
            />
          </div>
        </section>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .mc-hoy-col { display: flex !important; }
        }
      `}</style>
    </>
  );
}