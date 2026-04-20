import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { asegurarUsuario } from '@/api/usuario';
import { getInsforge } from '@/lib/insforge';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';

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
  const [busy, setBusy] = useState(false);

  if (!isLoading && authUser && usuario) {
    return <Navigate to={from === '/login' ? '/hoy' : from} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const insforge = getInsforge();
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('No se pudo iniciar sesión. Revisa el correo y la contraseña.');
      setBusy(false);
      return;
    }
    if (!data?.user) {
      toast.error('No se pudo iniciar sesión.');
      setBusy(false);
      return;
    }
    try {
      const row = await asegurarUsuario(data.user);
      setAuth(data.user, row);
      navigate(from === '/login' ? '/hoy' : from, { replace: true });
    } catch {
      toast.error('No se pudo cargar tu perfil. Intenta de nuevo.');
      await insforge.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">Iniciar sesión</h1>
      <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Acceso departamental</h2>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] p-6">
        <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
          <span className="text-[var(--mc-color-text-secondary)]">Correo</span>
          <input
            className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
          <span className="text-[var(--mc-color-text-secondary)]">Contraseña</span>
          <input
            type="password"
            className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-4 text-center text-[var(--mc-text-sm)] text-[var(--mc-color-text-secondary)]">
        ¿Sin cuenta?{' '}
        <Link to="/registro" className="text-[var(--mc-color-accent)]">
          Registrarse
        </Link>
      </p>
      </div>
    </div>
  );
}
