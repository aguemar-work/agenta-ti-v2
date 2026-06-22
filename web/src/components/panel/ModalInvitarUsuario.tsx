/**
 * ModalInvitarUsuario — invita por email a un workspace (057 + edge invite-user).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getWorkspacesDeOrg } from '@/api/workspace';
import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectInput } from '@/components/ui/SelectInput';
import { useInvitarAWorkspace } from '@/hooks/useUsuariosPlataforma';
import type { Organizacion } from '@/store/workspaceStore';

type Props = {
  open: boolean;
  onClose: () => void;
  orgs: Organizacion[];
};

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const rec = err as { message?: string; error?: string; data?: { error?: string } };
  if (typeof rec?.data?.error === 'string' && rec.data.error.trim()) return rec.data.error;
  if (typeof rec?.error === 'string' && rec.error.trim()) return rec.error;
  if (typeof rec?.message === 'string' && rec.message.trim()) return rec.message;
  return 'No se pudo enviar la invitación.';
}

export function ModalInvitarUsuario({ open, onClose, orgs }: Props) {
  const [email, setEmail]       = useState('');
  const [orgId, setOrgId]       = useState('');
  const [rol, setRol]           = useState<'jefe' | 'miembro'>('miembro');
  const [workspaceId, setWorkspaceId] = useState('');
  const [cargandoWs, setCargandoWs]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending, reset: resetMutation } = useInvitarAWorkspace(() => {
    toast.success('Invitación enviada. El usuario deberá aceptarla para acceder.');
    onClose();
  });

  /* eslint-disable react-hooks/set-state-in-effect -- resetea formulario al abrir modal */
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setOrgId(orgs[0]?.id ?? '');
    setRol('miembro');
    setWorkspaceId('');
    resetMutation();
    setTimeout(() => inputRef.current?.focus(), 50);
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
        console.error('[ModalInvitarUsuario] workspaces', err);
        if (!cancelled) setWorkspaceId('');
      } finally {
        if (!cancelled) setCargandoWs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, orgId]);

  const emailTrimmed = email.trim().toLowerCase();
  const canSubmit = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)
    && Boolean(workspaceId)
    && !isPending
    && !cargandoWs;

  const orgLabel = useMemo(
    () => orgs.find((o) => o.id === orgId)?.nombre ?? '',
    [orgs, orgId],
  );

  function submit() {
    if (!canSubmit) return;
    mutate(
      { email: emailTrimmed, rol, workspace_id: workspaceId },
      { onError: (err) => {
        console.error('[ModalInvitarUsuario]', err);
        toast.error(mensajeError(err));
      } },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invitar usuario"
      description="Se enviará una invitación al espacio de trabajo. El usuario deberá aceptarla para acceder."
      analyticsId="modal-invitar-usuario"
      size="md"
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      footer={(
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!canSubmit}
            onClick={submit}
          >
            Enviar invitación
          </Button>
          <CancelButton onClick={onClose} disabled={isPending} />
        </>
      )}
    >
      <div className="flex flex-col gap-[14px]">
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="invitar-email">
            Correo electrónico
          </label>
          <input
            ref={inputRef}
            id="invitar-email"
            type="email"
            className="mc-input"
            placeholder="usuario@empresa.com"
            value={email}
            disabled={isPending}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <p className="mc-field-hint">
            Si es cuenta nueva, recibirá un email para establecer su contraseña.
          </p>
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="invitar-org">
            Organización
          </label>
          {orgs.length === 0 ? (
            <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
              No hay organizaciones disponibles.
            </p>
          ) : (
            <SelectInput
              id="invitar-org"
              value={orgId}
              disabled={isPending}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nombre}
                </option>
              ))}
            </SelectInput>
          )}
          {orgLabel && cargandoWs ? (
            <p className="mc-field-hint">Cargando espacio de trabajo…</p>
          ) : null}
          {orgLabel && !cargandoWs && !workspaceId ? (
            <p className="mc-field-hint">La organización no tiene un espacio de trabajo activo.</p>
          ) : null}
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="invitar-rol">
            Rol
          </label>
          <SelectInput
            id="invitar-rol"
            value={rol}
            disabled={isPending}
            onChange={(e) => setRol(e.target.value as 'jefe' | 'miembro')}
          >
            <option value="miembro">Miembro</option>
            <option value="jefe">Jefe</option>
          </SelectInput>
        </div>
      </div>
    </Modal>
  );
}
