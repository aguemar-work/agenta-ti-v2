import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { getInsforge } from '@/lib/insforge';

type Step = 'loading' | 'form' | 'error';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlToken = searchParams.get('token');
  const status = searchParams.get('insforge_status');

  const [step, setStep] = useState<Step>('loading');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'ready' && urlToken) {
      setStep('form');
    } else {
      setStep('error');
    }
  }, [status, urlToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (!urlToken) return;

    setBusy(true);

    const { data: exchangeData, error: exchangeError } = await getInsforge().auth.exchangeResetPasswordToken({
      email,
      code: urlToken,
    });

    if (exchangeError || !exchangeData?.token) {
      toast.error('El enlace expiró o no es válido. Solicita uno nuevo.');
      setBusy(false);
      return;
    }

    setOtp(exchangeData.token);

    const { error: resetError } = await getInsforge().auth.resetPassword({
      newPassword,
      otp: exchangeData.token,
    });

    setBusy(false);

    if (resetError) {
      toast.error('No se pudo cambiar la contraseña. Intenta de nuevo.');
      return;
    }

    toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
    navigate('/login', { replace: true });
  }

  if (step === 'loading') {
    return (
      <div className={APP_PAGE_CLASS}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
          <div className="mb-6 flex justify-center">
            <AppLogo height={40} />
          </div>
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Verificando enlace…</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className={APP_PAGE_CLASS}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
          <div className="mb-6 flex justify-center">
            <AppLogo height={40} />
          </div>
          <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">Enlace inválido</h1>
          <p className="mt-2 text-sm text-[var(--mc-color-text-secondary)]">Este enlace no es válido o ya expiró.</p>
          <Link
            to="/forgot-password"
            className="mt-4 text-sm text-[var(--mc-color-text-secondary)] hover:text-[var(--mc-color-text)]"
          >
            Solicitar un nuevo enlace →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-6 flex justify-center">
          <AppLogo height={40} />
        </div>
        <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">Nueva contraseña</h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Ingresa tu correo y la nueva contraseña</h2>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 flex flex-col gap-4 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] p-6"
        >
          <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
            <span className="text-[var(--mc-color-text-secondary)]">Correo</span>
            <input
              type="email"
              className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
            <span className="text-[var(--mc-color-text-secondary)]">Nueva contraseña</span>
            <input
              type="password"
              className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
            <span className="text-[var(--mc-color-text-secondary)]">Confirmar contraseña</span>
            <input
              type="password"
              className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
              autoComplete="new-password"
              value={confirm}
              onChange={(ev) => setConfirm(ev.target.value)}
              required
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
          {otp ? <p className="text-[10px] text-[var(--mc-color-text-secondary)]">Token OTP procesado.</p> : null}
        </form>
      </div>
    </div>
  );
}
