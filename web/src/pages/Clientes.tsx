/**
 * pages/Clientes.tsx
 * Catálogo de clientes del workspace (módulo clientes).
 */

import { Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button, CancelButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { useClientesPage } from '@/hooks/useClientesPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';

export function Clientes() {
  const {
    esJefe,
    clientes,
    loadClientes,
    isError,
    modalOpen,
    editandoId,
    form,
    setForm,
    hasChanges,
    nombreValido,
    guardando,
    desactivarId,
    setDesactivarId,
    desactivando,
    abrirNuevo,
    abrirEditar,
    cerrarModal,
    submitForm,
    confirmarDesactivar,
  } = useClientesPage();

  const clienteDesactivar = clientes.find((c) => c.id === desactivarId);

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Clientes"
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
          No se pudieron cargar los clientes.
        </p>
      )}

      <div className="mc-card !p-0 overflow-hidden">
        {loadClientes ? (
          <p className="p-4 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : clientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin clientes"
            desc="Registra clientes para vincularlos a proyectos."
            cta={
              esJefe ? (
                <Button variant="primary" size="sm" onClick={abrirNuevo}>
                  Crear cliente
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="mc-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                {esJefe ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>
                    <span className="mc-badge mc-badge-success">Activo</span>
                  </td>
                  {esJefe ? (
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(c.id)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDesactivarId(c.id)}>
                          Desactivar
                        </Button>
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
        title={editandoId ? 'Editar cliente' : 'Nuevo cliente'}
        hasUnsavedChanges={hasChanges}
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
            onChange={(e) => setForm({ nombre: e.target.value })}
            autoFocus
            maxLength={200}
          />
        </label>
      </Modal>

      <ModalConfirmar
        open={Boolean(desactivarId)}
        titulo="Desactivar cliente"
        mensaje={
          clienteDesactivar
            ? `¿Desactivar «${clienteDesactivar.nombre}»? El registro se conserva pero dejará de aparecer en listados activos.`
            : '¿Desactivar este cliente?'
        }
        labelConfirmar="Desactivar"
        variantConfirmar="danger"
        cargando={desactivando}
        onConfirmar={confirmarDesactivar}
        onCancelar={() => setDesactivarId(null)}
        analyticsId="modal-desactivar-cliente"
      />
    </div>
  );
}
