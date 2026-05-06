import { useState } from 'react';
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
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

  async function onSubmit(e: React.FormEvent) {
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
    <>
      <style>{`
        @keyframes lf-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lf-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--mc-color-bg-page, #f5f5f3);
        }
        .lf-wrap {
          width: 100%;
          max-width: 388px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          animation: lf-up 0.4s ease both;
        }

        /* ── Branding (logo asset vía AppLogo) ── */
        .lf-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .lf-brand img {
          display: block;
        }

        /* ── Card ── */
        .lf-card {
          width: 100%;
          background: var(--mc-color-surface, #fff);
          border: 1px solid var(--mc-color-border);
          border-radius: 16px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-sizing: border-box;
        }
        .lf-title   { font-size: 16px; font-weight: 600; color: var(--mc-color-text); margin: 0 0 2px; }
        .lf-sub     { font-size: 13px; color: var(--mc-color-text-secondary); margin: 0; }

        /* ── Fields ── */
        .lf-field   { display: flex; flex-direction: column; gap: 6px; }
        .lf-label   { font-size: 11.5px; font-weight: 600; letter-spacing: 0.055em; text-transform: uppercase; color: var(--mc-color-text-secondary); }
        .lf-input {
          height: 42px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1.5px solid var(--mc-color-border);
          background: transparent;
          color: var(--mc-color-text);
          font-size: 14px;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.14s, box-shadow 0.14s;
        }
        .lf-input::placeholder { color: var(--mc-color-text-secondary); opacity: 0.45; }
        .lf-input:focus {
          border-color: var(--mc-color-accent, #1e40af);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-color-accent, #1e40af) 12%, transparent);
        }
        .lf-input.err { border-color: #dc2626; }
        .lf-input.err:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.11); }
        .lf-err   { font-size: 12px; color: #dc2626; }

        /* ── Password toggle ── */
        .lf-pwd   { position: relative; }
        .lf-pwd .lf-input { padding-right: 42px; }
        .lf-eye {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 4px; cursor: pointer;
          color: var(--mc-color-text-secondary); display: flex; align-items: center;
          border-radius: 4px; transition: color 0.13s; line-height: 0;
        }
        .lf-eye:hover { color: var(--mc-color-text); }

        /* ── Label row ── */
        .lf-row { display: flex; justify-content: space-between; align-items: center; }
        /* ── Divider ── */
        .lf-hr { height: 1px; background: var(--mc-color-border); }

        /* ── Footer ── */
        .lf-footer { font-size: 12px; color: var(--mc-color-text-secondary); text-align: center; margin: 0; }
      `}</style>

      <div className="lf-root">
        <div className="lf-wrap">

          {/* Marca: logo-nexora.png (texto duplicado innecesario si el wordmark ya lo incluye) */}
          <div className="lf-brand">
            <AppLogo height={52} className="max-w-[min(280px,85vw)]" />
          </div>

          {/* Card */}
          <div className="lf-card">
            <header>
              <h1 className="lf-title">Iniciar sesión</h1>
              <p className="lf-sub">Ingresa tus credenciales para continuar</p>
            </header>

            <form onSubmit={(e) => void onSubmit(e)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

              {/* Correo */}
              <div className="lf-field">
                <label className="lf-label" htmlFor="lf-email">Correo electrónico</label>
                <input
                  id="lf-email"
                  className={`lf-input${errors.email ? ' err' : ''}`}
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(ev) => { setEmail(ev.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                />
                {errors.email && <span className="lf-err">{errors.email}</span>}
              </div>

              {/* Contraseña */}
              <div className="lf-field">
                <div className="lf-row">
                  <label className="lf-label" htmlFor="lf-pwd">Contraseña</label>
                  <Link to="/forgot-password" className="mc-text-link">¿Olvidaste tu contraseña?</Link>
                </div>
                <div className="lf-pwd">
                  <input
                    id="lf-pwd"
                    className={`lf-input${errors.password ? ' err' : ''}`}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(ev) => { setPassword(ev.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  />
                  <button
                    type="button"
                    className="lf-eye"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <IconEye off={showPwd} />
                  </button>
                </div>
                {errors.password && <span className="lf-err">{errors.password}</span>}
              </div>

              <div className="lf-hr" />

              <Button type="submit" variant="primary" fullWidth disabled={busy}>
                {busy ? 'Verificando…' : 'Entrar'}
              </Button>
            </form>
          </div>

          <p className="lf-footer">¿Problemas para acceder? Contacta al administrador.</p>
        </div>
      </div>
    </>
  );
}