/**
 * components/semana/HoyPanel.tsx
 *
 * Panel "Hoy" con:
 *  - Ordenamiento dinámico: urgentes primero, luego por prioridad
 *  - Alertas visuales horarias integradas en TaskItem
 *  - Mobile: tabs + orden urgente arriba
 *  - Desktop: 3 columnas lado a lado
 */

import { useState } from 'react';

import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { urgenciaHoraria } from '@/lib/tareaUrgencia';
import type { NotaBitacora, Tarea } from '@/types';

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
}

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

// ---------------------------------------------------------------------------
// Columna Tareas
// ---------------------------------------------------------------------------
function ColTareas({
  hoyYmd, tareasPlan, puedeGestionar, esJefe,
  setDetalleTareaId, setReprDetalleTarea, setBloquearTareaState, setCompletarTareaId,
}: Pick<HoyPanelProps, 'hoyYmd' | 'tareasPlan' | 'puedeGestionar' | 'esJefe' |
  'setDetalleTareaId' | 'setReprDetalleTarea' | 'setBloquearTareaState' | 'setCompletarTareaId'>) {

  const atrasadas = tareasPlan.filter((t) => t.estado === 'atrasada');
  const delDia    = tareasPlan.filter((t) => t.fecha_planificada === hoyYmd && t.estado !== 'atrasada');
  const ordenadas = ordenarTareas(delDia);

  if (atrasadas.length === 0 && ordenadas.length === 0) {
    return (
      <div className="mc-empty">
        <p className="mc-empty-title">Sin tareas para hoy</p>
        <p className="mc-empty-desc">Las tareas planificadas para hoy aparecerán aquí</p>
      </div>
    );
  }

  return (
    <>
      {atrasadas.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--mc-color-border)' }}>
          <div style={{
            background:     '#FCEBEB',
            padding:        '6px 12px',
            fontSize:        11,
            fontWeight:      600,
            letterSpacing:  '.06em',
            textTransform:  'uppercase',
            color:          '#A32D2D',
            display:        'flex',
            alignItems:     'center',
            gap:             6,
          }}>
            <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#E24B4A' }} />
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
        <Button size="sm" onClick={() => setModalInc(true)}>+ Incidencia</Button>
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
        <Button size="sm" disabled={!notaRapida.trim()} onClick={() => void guardarNotaRapida()} aria-label="Agregar nota">
          +
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
    setBloquearTareaState, setCompletarTareaId, setModalInc } = props;

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
          style={{ display: tabActivo !== 'tareas' ? 'none' : undefined }}
        >
          <div className="mc-hoy-col-head hidden md:flex">
            <span>Tareas de hoy</span>
            {tareasPlan.filter((t) => t.estado === 'atrasada').length > 0 && (
              <span style={{ fontSize:11, fontWeight:600, color:'#A32D2D', background:'#FCEBEB', padding:'2px 8px', borderRadius:20 }}>
                {tareasPlan.filter((t) => t.estado === 'atrasada').length} atrasada{tareasPlan.filter((t) => t.estado === 'atrasada').length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="mc-hoy-col-body">
            <ColTareas
              hoyYmd={hoyYmd} tareasPlan={tareasPlan}
              puedeGestionar={puedeGestionar} esJefe={esJefe}
              setDetalleTareaId={setDetalleTareaId}
              setReprDetalleTarea={setReprDetalleTarea}
              setBloquearTareaState={setBloquearTareaState}
              setCompletarTareaId={setCompletarTareaId}
            />
          </div>
        </section>

        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'incidencias'}
          style={{ display: tabActivo !== 'incidencias' ? 'none' : undefined }}
        >
          <div className="mc-hoy-col-head hidden md:flex">
            <span>Incidencias del día</span>
            <Button size="sm" onClick={() => setModalInc(true)}>+ Nueva</Button>
          </div>
          <div className="mc-hoy-col-body">
            <ColIncidencias incidenciasHoy={incidenciasHoy} setModalInc={setModalInc} />
          </div>
        </section>

        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'bitacora'}
          style={{ display: tabActivo !== 'bitacora' ? 'none' : undefined }}
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