/**
 * pages/Areas.tsx
 * Catálogo de áreas del workspace (módulo areas).
 */

import { LayoutGrid } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button, CancelButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { useAreasPage } from '@/hooks/useAreasPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';

export function Areas() {
  const {
    esJefe,
    areas,
    loadAreas,
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
  } = useAreasPage();

  const areaDesactivar = areas.find((a) => a.id === desactivarId);

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Áreas"
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
          No se pudieron cargar las áreas.
        </p>
      )}

      <div className="mc-card !p-0 overflow-hidden">
        {loadAreas ? (
          <p className="p-4 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : areas.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="Sin áreas"
            desc="Define áreas para organizar el trabajo del equipo."
            cta={
              esJefe ? (
                <Button variant="primary" size="sm" onClick={abrirNuevo}>
                  Crear área
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
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>
                    <span className="mc-badge mc-badge-success">Activo</span>
                  </td>
                  {esJefe ? (
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(a.id)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDesactivarId(a.id)}>
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
        title={editandoId ? 'Editar área' : 'Nueva área'}
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
        titulo="Desactivar área"
        mensaje={
          areaDesactivar
            ? `¿Desactivar «${areaDesactivar.nombre}»? El registro se conserva pero dejará de aparecer en listados activos.`
            : '¿Desactivar esta área?'
        }
        labelConfirmar="Desactivar"
        variantConfirmar="danger"
        cargando={desactivando}
        onConfirmar={confirmarDesactivar}
        onCancelar={() => setDesactivarId(null)}
        analyticsId="modal-desactivar-area"
      />
    </div>
  );
}
