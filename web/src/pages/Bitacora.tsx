import { useState } from 'react';
import { toast } from 'sonner';

import { ModalConvertirEvento } from '@/components/bitacora/ModalConvertirEvento';
import { ModalConvertirTarea } from '@/components/bitacora/ModalConvertirTarea';
import { useBitacoraMutations, useNotasBitacora } from '@/hooks/useBitacora';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';
import type { NotaBitacora, TipoEvento, VisibilidadBitacora } from '@/types';

const visLabel: Record<VisibilidadBitacora, string> = {
  todos: 'Equipo',
  solo_jefe: 'Jefe',
  privado: 'Privado',
};

const visBadge: Record<VisibilidadBitacora, string> = {
  todos: 'mc-badge-info',
  solo_jefe: 'mc-badge-warning',
  privado: 'mc-badge-neutral',
};

export function Bitacora() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const [contenido, setContenido] = useState('');
  const [visibilidad, setVisibilidad] = useState<VisibilidadBitacora>('todos');
  const [notaParaTarea, setNotaParaTarea] = useState<NotaBitacora | null>(null);
  const [notaParaEvento, setNotaParaEvento] = useState<NotaBitacora | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  const { data: notas = [], isLoading } = useNotasBitacora(usuario?.id, esJefe);
  const mut = useBitacoraMutations(usuario?.id, esJefe);

  if (!usuario) return null;
  const me = usuario;

  async function guardarNota() {
    if (!contenido.trim()) return;
    try {
      await mut.insertarNota({
        usuario_id: me.id,
        contenido: contenido.trim(),
        visibilidad,
      });
      setContenido('');
      toast.success('Nota guardada');
    } catch {
      toast.error('No se pudo guardar la nota.');
    }
  }

  async function onConfirmarTarea(input: {
    titulo: string;
    descripcion: string;
    prioridad: 'alta' | 'media' | 'baja';
    fecha_planificada: string;
  }) {
    if (!notaParaTarea) return;
    try {
      await mut.convertirEnTarea({
        notaId: notaParaTarea.id,
        ...input,
        asignado_a: me.id,
        creado_por: me.id,
      });
      setNotaParaTarea(null);
      toast.success('Tarea creada');
    } catch {
      toast.error('No se pudo crear la tarea.');
    }
  }

  async function onConfirmarEvento(input: {
    titulo: string;
    tipo: TipoEvento;
    fecha_dia: string;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) {
    if (!notaParaEvento) return;
    try {
      await mut.convertirEnEvento({
        notaId: notaParaEvento.id,
        ...input,
        usuario_id: me.id,
      });
      setNotaParaEvento(null);
      toast.success('Evento creado');
    } catch {
      toast.error('No se pudo crear el evento.');
    }
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mb-4">
        <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
          Bitacora
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Registro de notas</h2>
      </div>

      <div className="mc-card mb-4 flex flex-col gap-3">
        <textarea
          className="mc-input min-h-[80px] resize-y text-sm"
          placeholder="Escribe una nota rapida..."
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              e.preventDefault();
              void guardarNota();
            }
          }}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--mc-color-text-secondary)]">
            Visibilidad
            <select
              className="mc-input !w-auto !py-1 text-xs"
              value={visibilidad}
              onChange={(e) => setVisibilidad(e.target.value as VisibilidadBitacora)}
            >
              <option value="todos">Equipo</option>
              <option value="solo_jefe">Jefe</option>
              <option value="privado">Privado</option>
            </select>
          </label>
          <button
            type="button"
            className="mc-btn ml-auto !px-4 !py-2 text-sm"
            disabled={!contenido.trim() || mut.isPending}
            onClick={() => void guardarNota()}
          >
            + Guardar nota
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando...</p>
      ) : notas.length === 0 ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin notas aun.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notas.map((n) => (
            <div key={n.id} className={`mc-card flex flex-col gap-2 ${n.convertida_en ? 'opacity-50' : ''}`.trim()}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {esJefe ? (
                    <span className="text-xs font-medium text-[var(--mc-color-text)]">{n.usuario?.nombre ?? n.usuario_id}</span>
                  ) : null}
                  <span className="text-xs text-[var(--mc-color-text-secondary)]">
                    {new Date(n.created_at).toLocaleString('es', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span className={`mc-badge ${visBadge[n.visibilidad]} text-[10px]`}>{visLabel[n.visibilidad]}</span>
                  {n.convertida_en ? (
                    <span className="text-[10px] italic text-[var(--mc-color-text-secondary)]">Convertida en {n.convertida_en}</span>
                  ) : null}
                </div>

                {!n.convertida_en ? (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className="mc-btn-ghost !p-1 text-[var(--mc-color-text-secondary)]"
                      onClick={() => setMenuAbierto(menuAbierto === n.id ? null : n.id)}
                    >
                      ...
                    </button>
                    {menuAbierto === n.id ? (
                      <div className="absolute right-0 top-7 z-20 min-w-[160px] rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] py-1">
                        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                          Convertir en
                        </p>
                        <button
                          type="button"
                          className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs"
                          onClick={() => {
                            setNotaParaTarea(n);
                            setMenuAbierto(null);
                          }}
                        >
                          Tarea
                        </button>
                        <button
                          type="button"
                          className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs"
                          onClick={() => {
                            setNotaParaEvento(n);
                            setMenuAbierto(null);
                          }}
                        >
                          Evento
                        </button>
                        <button
                          type="button"
                          className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs text-[var(--mc-color-text-secondary)]"
                          onClick={() => setMenuAbierto(null)}
                        >
                          Dejar como nota
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <p className="text-sm text-[var(--mc-color-text)]">{n.contenido}</p>
            </div>
          ))}
        </div>
      )}

      <ModalConvertirTarea nota={notaParaTarea} onClose={() => setNotaParaTarea(null)} onConfirm={onConfirmarTarea} />
      <ModalConvertirEvento nota={notaParaEvento} onClose={() => setNotaParaEvento(null)} onConfirm={onConfirmarEvento} />
    </div>
  );
}
