import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { getInsforge } from '@/lib/insforge';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setBusy_email] = useState('');
  const [busy, setBusy] = useState(false);

  // Alias limpio
  const [emailVal, setEmail] = [email, setBusy_email];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getInsforge().auth.sendResetPasswordEmail({
      email: emailVal,
      // redirectTo no es necesario en modo code — InsForge lo ignora
    });
    setBusy(false);
    if (error) {
      toast.error('No se pudo enviar el correo. Verifica la dirección.');
      return;
    }
    // Pasamos el email a la siguiente pantalla vía state de navegación
    navigate('/verify-reset-code', { state: { email: emailVal } });
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-6 flex justify-center">
          <AppLogo height={40} />
        </div>
        <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">
          Recuperar contraseña
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
          Te enviaremos un código de verificación a tu correo
        </h2>

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
              value={emailVal}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </label>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar código'}
          </Button>
        </form>

        <Link to="/login" className="mc-text-link-muted mt-4 block w-full text-center">
          ← Volver al login
        </Link>
      </div>
    </div>
  );
}