/**
 * ModalInvitarUsuario — envía una invitación por email vía edge function invite-user.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useInvitarUsuario } from '@/hooks/useUsuariosPlataforma';

type Props = {
  open:    boolean;
  onClose: () => void;
};

function mensajeError(err: unknown): string {
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo enviar la invitación.';
}

export function ModalInvitarUsuario({ open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending, reset: resetMutation } = useInvitarUsuario(() => {
    toast.success('Invitación enviada. El usuario recibirá un email para acceder.');
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    setEmail('');
    resetMutation();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, resetMutation]);

  const emailTrimmed = email.trim().toLowerCase();
  const canSubmit    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) && !isPending;

  function submit() {
    if (!canSubmit) return;
    mutate(emailTrimmed, {
      onError: (err) => {
        console.error('[ModalInvitarUsuario]', err);
        toast.error(mensajeError(err));
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invitar usuario"
      description="El usuario recibirá un email con un enlace para acceder a la plataforma."
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
          Se creará la cuenta y se enviará el enlace de acceso por email.
        </p>
      </div>
    </Modal>
  );
}
