/**
 * pages/Proyectos.tsx
 * Catálogo de proyectos del workspace (módulo proyectos).
 */

import { Folder } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button, CancelButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { useProyectosPage } from '@/hooks/useProyectosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';

const ESTADO_LABEL: Record<string, string> = {
  activo:     'Activo',
  completado: 'Completado',
  archivado:  'Archivado',
};

const ESTADO_BADGE: Record<string, string> = {
  activo:     'mc-badge-success',
  completado: 'mc-badge-neutral',
  archivado:  'mc-badge-neutral',
};

export function Proyectos() {
  const {
    esJefe,
    proyectos,
    clientes,
    loadProyectos,
    isError,
    nombreClientePorId,
    modalOpen,
    editandoId,
    form,
    setForm,
    hasChanges,
    nombreValido,
    guardando,
    archivarId,
    setArchivarId,
    archivando,
    abrirNuevo,
    abrirEditar,
    cerrarModal,
    submitForm,
    confirmarArchivar,
  } = useProyectosPage();

  const proyectoArchivar = proyectos.find((p) => p.id === archivarId);

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Proyectos"
        actions={
          esJefe ? (
            <Button variant="primary" size="sm" onClick={abrirNuevo}>
              + Nuevo
            </Button>
          ) : undefined
        }
      />

      {isError && (
        <p className="m-0 text-[13px] text-[var(--mc-color-danger)]">
          No se pudieron cargar los proyectos.
        </p>
      )}

      <div className="mc-card !p-0 overflow-hidden">
        {loadProyectos ? (
          <p className="p-4 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : proyectos.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="Sin proyectos"
            desc="Crea proyectos para agrupar trabajo por cliente o iniciativas internas."
            cta={
              esJefe ? (
                <Button variant="primary" size="sm" onClick={abrirNuevo}>
                  Crear proyecto
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="mc-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cliente</th>
                <th>Estado</th>
                {esJefe ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>
                    {p.cliente_id
                      ? (nombreClientePorId.get(p.cliente_id) ?? '—')
                      : 'Interno'}
                  </td>
                  <td>
                    <span className={`mc-badge ${ESTADO_BADGE[p.estado] ?? 'mc-badge-neutral'}`}>
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </td>
                  {esJefe ? (
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(p.id)}>
                          Editar
                        </Button>
                        {p.estado !== 'archivado' ? (
                          <Button variant="ghost" size="sm" onClick={() => setArchivarId(p.id)}>
                            Archivar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={cerrarModal}
        title={editandoId ? 'Editar proyecto' : 'Nuevo proyecto'}
        hasUnsavedChanges={hasChanges}
        bodyClassName="mc-modal-form"
        footer={
          <>
            <CancelButton onClick={cerrarModal} disabled={guardando} />
            <Button
              variant="primary"
              onClick={submitForm}
              disabled={!nombreValido || guardando}
            >
              {guardando ? 'Guardando…' : editandoId ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <label className="mc-field">
          <span className="mc-label">Nombre</span>
          <input
            className="mc-input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            autoFocus
            maxLength={200}
          />
        </label>

        <label className="mc-field">
          <span className="mc-label">Descripción</span>
          <textarea
            className="mc-input"
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </label>

        <label className="mc-field">
          <span className="mc-label">Cliente</span>
          <select
            className="mc-input"
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="mc-field">
          <span className="mc-label">Estado</span>
          <select
            className="mc-input"
            value={form.estado}
            onChange={(e) =>
              setForm({ ...form, estado: e.target.value as typeof form.estado })
            }
          >
            <option value="activo">Activo</option>
            <option value="completado">Completado</option>
          </select>
        </label>
      </Modal>

      <ModalConfirmar
        open={Boolean(archivarId)}
        titulo="Archivar proyecto"
        mensaje={
          proyectoArchivar
            ? `¿Archivar «${proyectoArchivar.nombre}»? El registro se conserva pero dejará de aparecer en listados activos.`
            : '¿Archivar este proyecto?'
        }
        labelConfirmar="Archivar"
        variantConfirmar="danger"
        cargando={archivando}
        onConfirmar={confirmarArchivar}
        onCancelar={() => setArchivarId(null)}
        analyticsId="modal-archivar-proyecto"
      />
    </div>
  );
}
