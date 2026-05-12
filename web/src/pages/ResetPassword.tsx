/**
 * pages/ResetPassword.tsx
 * Paso 3 del flujo de recuperación: ingresar nueva contraseña.
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
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

  if (!otp) {
    return <Navigate to="/forgot-password" replace />;
  }

  const pwdOk = newPassword.length >= MIN_PASSWORD;
  const match = newPassword === confirm;
  const canSubmit = pwdOk && match && !busy;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const { error } = await getInsforge().auth.resetPassword({ newPassword, otp });
    setBusy(false);
    if (error) {
      toast.error('No se pudo cambiar la contraseña. El código puede haber expirado.');
      return;
    }
    toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
    navigate('/login', { replace: true });
  }

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-logo">
          <AppLogo height={40} />
        </div>

        <div className="mc-auth-card">
          <div className="mc-auth-card-header">
            <h1 className="mc-auth-title">Nueva contraseña</h1>
            <p className="mc-auth-subtitle">
              Elige una contraseña de al menos {MIN_PASSWORD} caracteres
            </p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="mc-auth-form" noValidate>
            <div className="mc-field">
              <label htmlFor="rp-password" className="mc-field-label">
                Nueva contraseña
              </label>
              <div className="mc-auth-pwd">
                <input
                  id="rp-password"
                  type={showPwd ? 'text' : 'password'}
                  className="mc-input"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="mc-auth-pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <IconEye off={showPwd} />
                </button>
              </div>
              {newPassword.length > 0 && !pwdOk && (
                <span className="mc-field-error">Mínimo {MIN_PASSWORD} caracteres</span>
              )}
            </div>

            <div className="mc-field">
              <label htmlFor="rp-confirm" className="mc-field-label">
                Confirmar contraseña
              </label>
              <input
                id="rp-confirm"
                type={showPwd ? 'text' : 'password'}
                className="mc-input"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {confirm.length > 0 && !match && (
                <span className="mc-field-error">Las contraseñas no coinciden</span>
              )}
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={!canSubmit}>
              {busy ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </div>

        <Link to="/login" className="mc-auth-back-link">
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
