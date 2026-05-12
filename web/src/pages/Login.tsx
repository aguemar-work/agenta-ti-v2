import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { asegurarUsuario } from '@/api/usuario';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';

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

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/hoy';

  const authUser = useAuthStore((s) => s.authUser);
  const usuario = useAuthStore((s) => s.usuario);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  if (!isLoading && authUser && usuario) {
    return <Navigate to={from === '/login' ? '/hoy' : from} replace />;
  }

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'El correo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Ingresa un correo válido';
    if (!password) e.password = 'La contraseña es requerida';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setErrors({});
    const insforge = getInsforge();
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      setErrors({ password: 'Correo o contraseña incorrectos' });
      setBusy(false);
      return;
    }
    try {
      const row = await asegurarUsuario(data.user);
      setAuth(data.user, row);
      navigate(from === '/login' ? '/hoy' : from, { replace: true });
    } catch (err) {
      console.error('[onSubmit]', err);
      toast.error('No se pudo cargar tu perfil. Intenta de nuevo.');
      await insforge.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-logo">
          <AppLogo height={52} className="max-w-[min(280px,85vw)]" />
        </div>

        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <h1 className="mc-auth-title">Iniciar sesión</h1>
            <p className="mc-auth-subtitle">Ingresa tus credenciales para continuar</p>
          </header>

          <form onSubmit={(e) => void onSubmit(e)} className="mc-auth-form" noValidate>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="lf-email">
                Correo electrónico
              </label>
              <input
                id="lf-email"
                className={`mc-input${errors.email ? ' mc-input-error' : ''}`}
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
              />
              {errors.email ? <span className="mc-field-error">{errors.email}</span> : null}
            </div>

            <div className="mc-field">
              <div className="mc-auth-label-row">
                <label className="mc-field-label" htmlFor="lf-pwd">
                  Contraseña
                </label>
                <Link to="/forgot-password" className="mc-text-link">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="mc-auth-pwd">
                <input
                  id="lf-pwd"
                  className={`mc-input${errors.password ? ' mc-input-error' : ''}`}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(ev) => {
                    setPassword(ev.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
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
              {errors.password ? <span className="mc-field-error">{errors.password}</span> : null}
            </div>

            <div className="mc-divider" />

            <Button type="submit" variant="primary" fullWidth disabled={busy}>
              {busy ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mc-auth-footer">¿Problemas para acceder? Contacta al administrador.</p>
      </div>
    </div>
  );
}
