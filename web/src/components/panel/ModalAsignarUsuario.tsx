/**
 * ModalAsignarUsuario — invita a un usuario existente a otra organización (057).
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { UsuarioPlataforma } from '@/api/plataforma';
import { getWorkspacesDeOrg } from '@/api/workspace';
import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useInvitarAWorkspace } from '@/hooks/useUsuariosPlataforma';
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
  return 'No se pudo enviar la invitación.';
}

export function ModalAsignarUsuario({ open, onClose, usuario, orgs }: Props) {
  const [orgId, setOrgId] = useState('');
  const [rol, setRol] = useState<'jefe' | 'miembro'>('miembro');
  const [workspaceId, setWorkspaceId] = useState('');
  const [cargandoWs, setCargandoWs] = useState(false);

  const { mutate, isPending, reset: resetMutation } = useInvitarAWorkspace(() => {
    toast.success('Invitación enviada. El usuario deberá aceptarla para acceder.');
    onClose();
  });

  /* eslint-disable react-hooks/set-state-in-effect -- resetea formulario al abrir modal */
  useEffect(() => {
    if (!open) return;
    setOrgId(orgs[0]?.id ?? '');
    setRol('miembro');
    setWorkspaceId('');
    resetMutation();
  }, [open, orgs, resetMutation]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open || !orgId) {
      setWorkspaceId('');
      return;
    }

    let cancelled = false;
    setCargandoWs(true);

    void (async () => {
      try {
        const lista = await getWorkspacesDeOrg(orgId);
        if (cancelled) return;
        setWorkspaceId(lista[0]?.id ?? '');
      } catch (err) {
        console.error('[ModalAsignarUsuario] workspaces', err);
        if (!cancelled) setWorkspaceId('');
      } finally {
        if (!cancelled) setCargandoWs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, orgId]);

  const canSubmit = Boolean(usuario && orgId && workspaceId && !isPending && !cargandoWs);

  const orgLabel = useMemo(
    () => orgs.find((o) => o.id === orgId)?.nombre ?? '',
    [orgs, orgId],
  );

  const membresiaActual = usuario?.orgs.find((o) => o.organizacion_id === orgId);

  function submit() {
    if (!usuario || !workspaceId) return;
    mutate(
      {
        email: usuario.email,
        rol,
        workspace_id: workspaceId,
        nombre: usuario.nombre,
      },
      {
        onError: (err) => {
          console.error('[ModalAsignarUsuario]', err);
          toast.error(mensajeError(err));
        },
      },
    );
  }

  const description = usuario
    ? `Invita a ${usuario.nombre} a una organización. Deberá aceptar la invitación para acceder.`
    : 'Selecciona un usuario desde la lista.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invitar a organización"
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
            Enviar invitación
          </Button>
          <CancelButton onClick={onClose} disabled={isPending} />
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
            {membresiaActual?.estado === 'activo' ? (
              <p className="mc-field-hint">Ya es miembro activo en esta organización.</p>
            ) : membresiaActual?.estado === 'pendiente' ? (
              <p className="mc-field-hint">Ya tiene una invitación pendiente; se actualizará el rol si cambia.</p>
            ) : null}
            {orgLabel && cargandoWs ? (
              <p className="mc-field-hint">Cargando espacio de trabajo…</p>
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
