/**
 * pages/ResetPassword.tsx
 * Paso 3 del flujo de recuperación: ingresar nueva contraseña.
 *
 * Recibe el OTP desde VerifyResetCode vía navigation state.
 * Llama a resetPassword({ newPassword, otp }).
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { getInsforge } from '@/lib/insforge';

const MIN_PASSWORD = 8;

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { otp?: string; email?: string } | null;
  const otp = state?.otp ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sin OTP — acceso directo a la URL o flujo incompleto
  if (!otp) {
    return (
      <div className={APP_PAGE_CLASS}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 gap-4">
          <p className="text-sm text-[var(--mc-color-text-secondary)]">
            El enlace no es válido o ya expiró. Por favor inicia el proceso de nuevo.
          </p>
          <Link to="/forgot-password" className="mc-text-link">
            → Recuperar contraseña
          </Link>
        </div>
      </div>
    );
  }

  const pwdOk = newPassword.length >= MIN_PASSWORD;
  const match = newPassword === confirm;
  const canSubmit = pwdOk && match && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);

    const { error } = await getInsforge().auth.resetPassword({
      newPassword,
      otp,
    });

    setBusy(false);

    if (error) {
      toast.error('No se pudo cambiar la contraseña. El código puede haber expirado.');
      return;
    }

    toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
    navigate('/login', { replace: true });
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-6 flex justify-center">
          <AppLogo height={40} />
        </div>
        <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">
          Nueva contraseña
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
          Elige una contraseña de al menos {MIN_PASSWORD} caracteres
        </h2>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 flex flex-col gap-4 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] p-6"
          noValidate
        >
          {/* Nueva contraseña */}
          <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
            <span className="text-[var(--mc-color-text-secondary)]">Nueva contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2 w-full"
                style={{ paddingRight: 40 }}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--mc-color-text-secondary)', display: 'flex',
                  padding: 4, borderRadius: 4,
                }}
              >
                <IconEye off={showPwd} />
              </button>
            </div>
            {newPassword.length > 0 && !pwdOk && (
              <span className="text-xs text-red-600">Mínimo {MIN_PASSWORD} caracteres</span>
            )}
          </label>

          {/* Confirmar contraseña */}
          <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
            <span className="text-[var(--mc-color-text-secondary)]">Confirmar contraseña</span>
            <input
              type={showPwd ? 'text' : 'password'}
              className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirm.length > 0 && !match && (
              <span className="text-xs text-red-600">Las contraseñas no coinciden</span>
            )}
          </label>

          <Button type="submit" variant="primary" fullWidth disabled={!canSubmit}>
            {busy ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </form>

        <Link to="/login" className="mc-text-link-muted mt-4 block w-full text-center">
          ← Volver al login
        </Link>
      </div>
    </div>
  );
}