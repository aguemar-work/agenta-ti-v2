import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { asegurarUsuario } from '@/api/usuario';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import { getInsforge } from '@/lib/insforge';
import { destinoPostLogin } from '@/lib/rutasInternas';
import { useAuthStore } from '@/store/authStore';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/semana';

  const authUser = useAuthStore((s) => s.authUser);
  const usuario = useAuthStore((s) => s.usuario);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const formIncomplete = !email.trim() || !password;

  if (!isLoading && authUser && usuario) {
    return <Navigate to={destinoPostLogin(from)} replace />;
  }

  function validate() {
    const e: typeof fieldErrors = {};
    if (!email.trim()) e.email = 'El correo es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Ingresa un correo válido';
    if (!password) e.password = 'La contraseña es requerida';
    setFieldErrors(e);
    setAuthError(null);
    return Object.keys(e).length === 0;
  }

  function clearAuthFeedback() {
    setAuthError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setFieldErrors({});
    setAuthError(null);
    const insforge = getInsforge();
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      setAuthError('Correo o contraseña incorrectos');
      setBusy(false);
      return;
    }
    try {
      const row = await asegurarUsuario(data.user);
      setAuth(data.user, row);
      navigate(destinoPostLogin(from), { replace: true });
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
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <div className="mc-auth-brand">
              <AppLogo height={32} className="max-w-[min(200px,70vw)]" />
            </div>
            <h1 className="mc-auth-title">Iniciar sesión</h1>
            <p className="mc-auth-subtitle">Ingresa tus credenciales para continuar</p>
          </header>

          <form onSubmit={(e) => void onSubmit(e)} className="mc-auth-form" noValidate>
            {authError ? (
              <div className="mc-auth-alert" role="alert">
                {authError}
              </div>
            ) : null}

            <div className="mc-field">
              <label className="mc-field-label" htmlFor="lf-email">
                Correo electrónico
              </label>
              <input
                id="lf-email"
                className={`mc-input${fieldErrors.email ? ' mc-input-error' : ''}`}
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  clearAuthFeedback();
                  if (fieldErrors.email) {
                    setFieldErrors((p) => {
                      const next = { ...p };
                      delete next.email;
                      return next;
                    });
                  }
                }}
              />
              <div className="mc-field-feedback">
                {fieldErrors.email ? (
                  <span className="mc-field-error">{fieldErrors.email}</span>
                ) : null}
              </div>
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
                  className={`mc-input${fieldErrors.password ? ' mc-input-error' : ''}`}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(ev) => {
                    setPassword(ev.target.value);
                    clearAuthFeedback();
                    if (fieldErrors.password) {
                      setFieldErrors((p) => {
                        const next = { ...p };
                        delete next.password;
                        return next;
                      });
                    }
                  }}
                />
                <button
                  type="button"
                  className="mc-auth-pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              <div className="mc-field-feedback">
                {fieldErrors.password ? (
                  <span className="mc-field-error">{fieldErrors.password}</span>
                ) : null}
              </div>
            </div>

            <div className="mc-divider" />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={busy}
              className={formIncomplete ? 'mc-btn--incomplete' : ''}
            >
              {busy ? 'Verificando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mc-auth-footer">
          ¿Problemas para acceder? Contacta al administrador.
          {' · '}
          <Link to="/privacidad" className="mc-link">
            Tratamiento de datos
          </Link>
        </p>
      </div>
    </div>
  );
}
