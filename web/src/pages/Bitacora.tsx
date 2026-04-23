import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

import { ModalConvertirEvento } from '@/components/bitacora/ModalConvertirEvento';
import { ModalConvertirTarea } from '@/components/bitacora/ModalConvertirTarea';
import { useBitacoraMutations, useNotasBitacora } from '@/hooks/useBitacora';
import { useDraftForm } from '@/hooks/useDraftForm';
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

const NOTA_INICIAL = { contenido: '', visibilidad: 'todos' as VisibilidadBitacora };

export function Bitacora() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const { form: notaForm, setForm: setNotaForm, clearDraft: clearNotaDraft } = useDraftForm(
    'bitacora-nota-nueva',
    NOTA_INICIAL,
  );
  const [notaParaTarea, setNotaParaTarea] = useState<NotaBitacora | null>(null);
  const [notaParaEvento, setNotaParaEvento] = useState<NotaBitacora | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  const { data: notas = [], isLoading } = useNotasBitacora(usuario?.id, esJefe);
  const mut = useBitacoraMutations(usuario?.id, esJefe);

  if (!usuario) return null;
  const me = usuario;

  async function guardarNota() {
    if (!notaForm.contenido.trim()) return;
    try {
      await mut.insertarNota({
        usuario_id: me.id,
        contenido: notaForm.contenido.trim(),
        visibilidad: notaForm.visibilidad,
      });
      clearNotaDraft();
      setNotaForm(NOTA_INICIAL);
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNota]', err);
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
    } catch (err) {
      console.error('[onConfirmarTarea]', err);
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
    } catch (err) {
      console.error('[onConfirmarEvento]', err);
      toast.error('No se pudo crear el evento.');
    }
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <header className="mc-page-header">
        <div>
          <h1 className="mc-page-title">Bitácora</h1>
          <h2 className="mc-page-subtitle">Registro de notas y bitácora diaria</h2>
        </div>
      </header>

      <div className="mc-card mb-6 flex flex-col gap-4">
        <div className="mc-field">
          <textarea
            className="mc-input min-h-[100px] resize-y text-sm"
            placeholder="Escribe una nota rápida..."
            value={notaForm.contenido}
            onChange={(e) => setNotaForm((p) => ({ ...p, contenido: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                e.preventDefault();
                void guardarNota();
              }
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="mc-field !mb-0">
            <label className="mc-field-label" htmlFor="bitacora-vis">Visibilidad</label>
            <select
              id="bitacora-vis"
              className="mc-input !w-auto !py-1 text-xs"
              value={notaForm.visibilidad}
              onChange={(e) => setNotaForm((p) => ({ ...p, visibilidad: e.target.value as VisibilidadBitacora }))}
            >
              <option value="todos">Equipo</option>
              <option value="solo_jefe">Jefe</option>
              <option value="privado">Privado</option>
            </select>
          </div>
          <Button
            className="ml-auto"
            disabled={!notaForm.contenido.trim() || mut.isPending}
            onClick={() => void guardarNota()}
          >
            + Guardar nota
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando...</p>
      ) : notas.length === 0 ? (
        <div className="mc-empty">
          <p className="mc-empty-title">Sin notas aún</p>
          <p className="mc-empty-desc">Las notas que guardes aparecerán aquí.</p>
        </div>
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
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[var(--mc-color-text-secondary)]"
                      onClick={() => setMenuAbierto(menuAbierto === n.id ? null : n.id)}
                    >
                      ...
                    </Button>
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
