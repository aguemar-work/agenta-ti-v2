/**
 * ModalAsignarUsuario — asigna un usuario a una org vía RPC sgtd_asignar_usuario_a_organizacion.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { UsuarioPlataforma } from '@/api/plataforma';
import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsignarUsuario } from '@/hooks/useUsuariosPlataforma';
import type { Organizacion } from '@/store/workspaceStore';

type Props = {
  open: boolean;
  onClose: () => void;
  usuario: UsuarioPlataforma | null;
  orgs: Organizacion[];
};

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo asignar el usuario.';
}

export function ModalAsignarUsuario({ open, onClose, usuario, orgs }: Props) {
  const [orgId, setOrgId] = useState('');
  const [rol, setRol] = useState<'jefe' | 'miembro'>('miembro');

  const { mutate, isPending, reset: resetMutation } = useAsignarUsuario(() => {
    const yaEnOrg = usuario?.orgs.some((o) => o.organizacion_id === orgId);
    toast.success(yaEnOrg ? 'Asignación actualizada' : 'Usuario asignado');
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    setOrgId(orgs[0]?.id ?? '');
    setRol('miembro');
    resetMutation();
  }, [open, orgs, resetMutation]);

  const canSubmit = Boolean(usuario && orgId && !isPending);

  const orgLabel = useMemo(
    () => orgs.find((o) => o.id === orgId)?.nombre ?? '',
    [orgs, orgId],
  );

  function cerrar() {
    onClose();
  }

  function submit() {
    if (!usuario || !orgId) return;
    mutate(
      { usuarioId: usuario.usuario_id, orgId, rol },
      {
        onError: (err) => {
          console.error('[ModalAsignarUsuario]', err);
          toast.error(mensajeError(err));
        },
      },
    );
  }

  const description = usuario
    ? `Asigna a ${usuario.nombre} a una organización con rol operativo.`
    : 'Selecciona un usuario desde la lista.';

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Asignar a organización"
      analyticsId="modal-asignar-usuario"
      size="md"
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      description={description}
      footer={(
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!canSubmit}
            onClick={() => submit()}
          >
            Asignar
          </Button>
          <CancelButton onClick={cerrar} disabled={isPending} />
        </>
      )}
    >
      {!usuario ? (
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
          Selecciona un usuario desde la lista.
        </p>
      ) : (
        <div className="flex flex-col gap-[14px]">
          <div className="mc-field">
            <span className="mc-field-label">Usuario</span>
            <p className="m-0 text-sm text-[var(--mc-color-text-primary)]">{usuario.nombre}</p>
            <p className="m-0 text-xs text-[var(--mc-color-text-secondary)]">{usuario.email}</p>
          </div>

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="asignar-org">
              Organización
            </label>
            {orgs.length === 0 ? (
              <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
                No hay organizaciones disponibles.
              </p>
            ) : (
              <select
                id="asignar-org"
                className="mc-input"
                value={orgId}
                disabled={isPending}
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.nombre}
                  </option>
                ))}
              </select>
            )}
            {orgLabel && usuario.orgs.some((o) => o.organizacion_id === orgId) ? (
              <p className="mc-field-hint">
                Ya pertenece a esta organización; se actualizará el rol si cambia.
              </p>
            ) : null}
          </div>

          <div className="mc-field">
            <label className="mc-field-label" htmlFor="asignar-rol">
              Rol
            </label>
            <select
              id="asignar-rol"
              className="mc-input"
              value={rol}
              disabled={isPending}
              onChange={(e) => setRol(e.target.value as 'jefe' | 'miembro')}
            >
              <option value="miembro">Miembro</option>
              <option value="jefe">Jefe</option>
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}
