import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { getInsforge } from '@/lib/insforge';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getInsforge().auth.sendResetPasswordEmail({ email });
    setBusy(false);
    if (error) {
      toast.error('No se pudo enviar el correo. Verifica la dirección.');
      return;
    }
    navigate('/verify-reset-code', { state: { email } });
  }

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-logo">
          <AppLogo height={40} />
        </div>

        <div className="mc-auth-card">
          <div className="mc-auth-card-header">
            <h1 className="mc-auth-title">Recuperar contraseña</h1>
            <p className="mc-auth-subtitle">
              Te enviaremos un código de verificación a tu correo
            </p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="mc-auth-form">
            <div className="mc-field">
              <label htmlFor="fp-email" className="mc-field-label">
                Correo electrónico
              </label>
              <input
                id="fp-email"
                type="email"
                className="mc-input"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="primary" fullWidth loading={busy}>
              Enviar código
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
