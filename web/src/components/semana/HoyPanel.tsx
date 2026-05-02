/**
 * components/semana/HoyPanel.tsx
 *
 * Panel "Hoy" con layout responsivo:
 *   - Móvil  (< md): tabs horizontales — una sección a la vez
 *   - Desktop (md+): 3 columnas lado a lado
 *
 * Resuelve el hallazgo de auditoría: 3 columnas simultáneas a 390px
 * comprimían cada columna a ~110px, haciendo el contenido ilegible.
 */

import { useState } from 'react';

import { TaskItem } from '@/components/tareas/TaskItem';
import { Button } from '@/components/ui/Button';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import type { NotaBitacora, Tarea } from '@/types';

type Tab = 'tareas' | 'incidencias' | 'bitacora';

interface HoyPanelProps {
  hoyYmd:             string;
  tareasPlan:         Tarea[];
  incidenciasHoy:     Tarea[];
  notasHoy:           NotaBitacora[];
  notaRapida:         string;
  setNotaRapida:      (v: string) => void;
  guardarNotaRapida:  () => Promise<void>;
  puedeGestionar:     (t: Tarea) => boolean;
  setDetalleTareaId:  (id: string) => void;
  setReprDetalleTarea:(t: Tarea) => void;
  setBloquearTareaState:(t: Tarea) => void;
  setCompletarTareaId:(id: string) => void;
  setModalInc:        (v: boolean) => void;
}

// ── Sub-secciones ────────────────────────────────────────────────────────────

function ColTareas({ hoyYmd, tareasPlan, puedeGestionar, setDetalleTareaId, setReprDetalleTarea, setBloquearTareaState, setCompletarTareaId }: Pick<HoyPanelProps, 'hoyYmd' | 'tareasPlan' | 'puedeGestionar' | 'setDetalleTareaId' | 'setReprDetalleTarea' | 'setBloquearTareaState' | 'setCompletarTareaId'>) {
  const atrasadas = tareasPlan.filter((t) => t.estado === 'atrasada');
  const delDia    = tareasPlan.filter((t) => t.fecha_planificada === hoyYmd && t.estado !== 'atrasada');

  if (atrasadas.length === 0 && delDia.length === 0) {
    return <div className="mc-empty"><p className="mc-empty-title">Sin tareas para hoy</p></div>;
  }

  return (
    <>
      {atrasadas.length > 0 && (
        <div className="border-b border-[var(--mc-color-border)]">
          <div className="bg-[var(--mc-color-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Atrasadas
          </div>
          <div className="flex flex-col gap-2 p-2">
            {atrasadas.map((t) => (
              <TaskItem key={t.id} variant="week" tarea={t}
                readOnly={!puedeGestionar(t)}
                estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
                onOpenDetalle={() => setDetalleTareaId(t.id)}
                onReprogramar={puedeGestionar(t) ? (x) => setReprDetalleTarea(x) : undefined}
                onBloquear={puedeGestionar(t) ? (x) => setBloquearTareaState(x) : undefined}
                onCompletar={puedeGestionar(t) ? (x) => setCompletarTareaId(x.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 p-2">
        {delDia.map((t) => (
          <TaskItem key={t.id} variant="week" tarea={t}
            readOnly={!puedeGestionar(t)}
            estadoVisual={estadoEfectivoTablero(t, hoyYmd)}
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

function ColIncidencias({ incidenciasHoy, setModalInc }: Pick<HoyPanelProps, 'incidenciasHoy' | 'setModalInc'>) {
  return (
    <>
      {/* Botón añadir incidencia — visible en ambos layouts */}
      <div className="flex items-center justify-end px-2 pb-2 border-b border-[var(--mc-color-border)]">
        <Button size="sm" onClick={() => setModalInc(true)}>+ Incidencia</Button>
      </div>
      {incidenciasHoy.length === 0 ? (
        <div className="mc-empty"><p className="mc-empty-title">Sin incidencias</p></div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {incidenciasHoy.map((t) => (
            <TaskItem key={t.id} variant="week" tarea={t} readOnly />
          ))}
        </div>
      )}
    </>
  );
}

function ColBitacora({ notasHoy, notaRapida, setNotaRapida, guardarNotaRapida }: Pick<HoyPanelProps, 'notasHoy' | 'notaRapida' | 'setNotaRapida' | 'guardarNotaRapida'>) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2 border-b border-[var(--mc-color-border)] pb-2">
        <input
          className="mc-input flex-1 !py-2 text-sm"
          placeholder="Nota rápida…"
          value={notaRapida}
          onChange={(e) => setNotaRapida(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardarNotaRapida(); } }}
        />
        <Button size="sm" disabled={!notaRapida.trim()} onClick={() => void guardarNotaRapida()} aria-label="Agregar nota">+</Button>
      </div>
      {notasHoy.length === 0 ? (
        <div className="mc-empty"><p className="mc-empty-title">Sin notas recientes</p></div>
      ) : (
        <div className="flex flex-col gap-2">
          {notasHoy.map((n) => (
            <div key={n.id} className="mc-entity-card">
              <span className="text-xs text-[var(--mc-color-text-secondary)]">
                {new Date(n.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <p className="text-sm text-[var(--mc-color-text)]">{n.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── HoyPanel ─────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  tareas:      'Tareas',
  incidencias: 'Incidencias',
  bitacora:    'Bitácora',
};

export function HoyPanel(props: HoyPanelProps) {
  const [tabActivo, setTabActivo] = useState<Tab>('tareas');

  const { hoyYmd, tareasPlan, incidenciasHoy, notasHoy, notaRapida, setNotaRapida, guardarNotaRapida, puedeGestionar, setDetalleTareaId, setReprDetalleTarea, setBloquearTareaState, setCompletarTareaId, setModalInc } = props;

  return (
    <>
      {/* ── Tabs — solo visibles en móvil (md: hidden) ────────────────── */}
      <div className="flex border-b border-[var(--mc-color-border)] md:hidden">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tabActivo === tab}
            onClick={() => setTabActivo(tab)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '13px',
              fontWeight: tabActivo === tab ? 600 : 400,
              color: tabActivo === tab ? 'var(--mc-color-accent)' : 'var(--mc-color-text-secondary)',
              borderBottom: tabActivo === tab ? '2px solid var(--mc-color-accent)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: tabActivo === tab ? 'var(--mc-color-accent)' : 'transparent',
              cursor: 'pointer',
              transition: 'color 0.13s',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Contenido: tab activo en móvil · todas las cols en md+ ─────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

        {/* Col 1: Tareas */}
        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'tareas'}
          style={{ display: tabActivo !== 'tareas' ? 'none' : undefined }}
          // En md+ siempre visible via CSS override abajo
        >
          <div className="mc-hoy-col-head hidden md:flex"><span>Tareas planificadas</span></div>
          <div className="mc-hoy-col-body">
            <ColTareas
              hoyYmd={hoyYmd}
              tareasPlan={tareasPlan}
              puedeGestionar={puedeGestionar}
              setDetalleTareaId={setDetalleTareaId}
              setReprDetalleTarea={setReprDetalleTarea}
              setBloquearTareaState={setBloquearTareaState}
              setCompletarTareaId={setCompletarTareaId}
            />
          </div>
        </section>

        {/* Col 2: Incidencias */}
        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'incidencias'}
          style={{ display: tabActivo !== 'incidencias' ? 'none' : undefined }}
        >
          <div className="mc-hoy-col-head hidden md:flex">
            <span>Incidencias del día</span>
            <Button size="sm" onClick={() => setModalInc(true)}>+</Button>
          </div>
          <div className="mc-hoy-col-body">
            <ColIncidencias incidenciasHoy={incidenciasHoy} setModalInc={setModalInc} />
          </div>
        </section>

        {/* Col 3: Bitácora */}
        <section
          className="mc-hoy-col"
          hidden={tabActivo !== 'bitacora'}
          style={{ display: tabActivo !== 'bitacora' ? 'none' : undefined }}
        >
          <div className="mc-hoy-col-head hidden md:flex"><span>Bitácora</span></div>
          <div className="mc-hoy-col-body">
            <ColBitacora
              notasHoy={notasHoy}
              notaRapida={notaRapida}
              setNotaRapida={setNotaRapida}
              guardarNotaRapida={guardarNotaRapida}
            />
          </div>
        </section>

      </div>

      {/*
        En md+ las secciones deben mostrarse todas, ignorando el hidden/display.
        Usamos un style tag inline para no depender de PurgeCSS o configuración extra.
      */}
      <style>{`
        @media (min-width: 768px) {
          .mc-hoy-col { display: flex !important; }
        }
      `}</style>
    </>
  );
}