/**
 * ModalGestionarModulos — activar/desactivar módulos vía RPC 050 (panel dueño).
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useModulosOrg, useSetModuloOrg } from '@/hooks/useModulosOrg';
import { CATALOGO_MODULOS } from '@/lib/modulos';
import type { Organizacion } from '@/store/workspaceStore';

type Props = {
  open: boolean;
  onClose: () => void;
  org: Organizacion | null;
};

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo actualizar el módulo.';
}

export function ModalGestionarModulos({ open, onClose, org }: Props) {
  const orgId = org?.id ?? null;
  const { data: modulosEstado, isLoading, isError } = useModulosOrg(orgId, open);
  const { mutate, isPending } = useSetModuloOrg(orgId ?? '');
  const [moduloPendiente, setModuloPendiente] = useState<string | null>(null);

  const activoPorModulo = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of modulosEstado ?? []) {
      map.set(row.modulo, row.activo);
    }
    return map;
  }, [modulosEstado]);

  function cerrar() {
    if (isPending) return;
    onClose();
  }

  function toggleModulo(clave: string, obligatorio: boolean, activoActual: boolean) {
    if (!orgId || obligatorio || isPending) return;
    const nuevoActivo = !activoActual;
    setModuloPendiente(clave);
    mutate(
      { modulo: clave, activo: nuevoActivo },
      {
        onSuccess: () => {
          toast.success(
            nuevoActivo
              ? 'Módulo activado'
              : 'Módulo desactivado — los datos se conservan',
          );
        },
        onError: (err) => {
          console.error('[ModalGestionarModulos]', err);
          toast.error(mensajeError(err));
        },
        onSettled: () => {
          setModuloPendiente(null);
        },
      },
    );
  }

  const titulo = org ? `Módulos de ${org.nombre}` : 'Módulos';

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={titulo}
      analyticsId="modal-gestionar-modulos"
      size="md"
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      description="Activa o desactiva funcionalidades para esta organización. Desactivar oculta la UI pero conserva los datos."
      footer={<CancelButton onClick={cerrar} disabled={isPending} />}
    >
      {!org ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
          Selecciona una organización.
        </p>
      ) : isLoading ? (
        <p className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando módulos…</p>
      ) : isError ? (
        <p className="m-0 text-[13px] text-[var(--mc-color-danger)]" role="alert">
          No se pudieron cargar los módulos.
        </p>
      ) : (
        <fieldset className="mc-field border-0 p-0 m-0">
          <legend className="mc-field-label mb-2">Módulos activos</legend>
          <ul className="flex flex-col gap-2">
            {CATALOGO_MODULOS.map((mod) => {
              const activo = mod.obligatorio || (activoPorModulo.get(mod.clave) ?? false);
              const busy = isPending && moduloPendiente === mod.clave;
              const disabled = mod.obligatorio || isPending;
              return (
                <li key={mod.clave}>
                  <label
                    className={
                      mod.obligatorio
                        ? 'flex cursor-default items-start gap-2 rounded-md border border-[var(--mc-color-border)] px-3 py-2 opacity-90'
                        : 'flex cursor-pointer items-start gap-2 rounded-md border border-[var(--mc-color-border)] px-3 py-2'
                    }
                  >
                    <input
                      type="checkbox"
                      className="mc-checkbox mt-0.5"
                      checked={activo}
                      disabled={disabled}
                      onChange={() => toggleModulo(mod.clave, mod.obligatorio, activo)}
                      aria-disabled={mod.obligatorio || undefined}
                      aria-busy={busy || undefined}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--mc-color-text)]">
                        {mod.nombre}
                        {mod.obligatorio && (
                          <span className="mc-badge mc-badge-neutral text-[10px]">Incluido</span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--mc-color-text-secondary)]">
                        {mod.descripcion}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </Modal>
  );
}
