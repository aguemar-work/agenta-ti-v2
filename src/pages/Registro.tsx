import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { asegurarUsuario } from '@/api/usuario';
import { Button } from '@/components/ui/Button';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';

export function Registro() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.authUser);
  const usuario = useAuthStore((s) => s.usuario);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isLoading && authUser && usuario) {
    return <Navigate to="/hoy" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const insforge = getInsforge();
    const origin = window.location.origin;
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name: nombre,
      redirectTo: `${origin}/login`,
    });

    if (error) {
      toast.error('No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.');
      setBusy(false);
      return;
    }

    if (data?.requireEmailVerification) {
      toast.message('Revisa tu correo', {
        description: 'Debes confirmar el enlace antes de entrar.',
      });
      navigate('/login', { replace: true });
      setBusy(false);
      return;
    }

    if (data?.accessToken && data.user) {
      try {
        const row = await asegurarUsuario(data.user);
        setAuth(data.user, row);
        toast.success('Cuenta creada');
        navigate('/hoy', { replace: true });
      } catch {
        toast.error('Cuenta creada, pero no se pudo crear el perfil departamental. Contacta al administrador.');
        await insforge.auth.signOut();
      } finally {
        setBusy(false);
      }
      return;
    }

    toast.error('Respuesta inesperada del servidor.');
    setBusy(false);
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <h1 className="text-[var(--mc-text-lg)] font-semibold text-[var(--mc-color-text)]">Registro</h1>
      <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Alta de cuenta</h2>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-6 flex flex-col gap-4 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] p-6"
      >
        <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
          <span className="text-[var(--mc-color-text-secondary)]">Nombre</span>
          <input
            className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
            value={nombre}
            onChange={(ev) => setNombre(ev.target.value)}
            required
            minLength={2}
          />
        </label>
        <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
          <span className="text-[var(--mc-color-text-secondary)]">Correo</span>
          <input
            className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[var(--mc-text-sm)]">
          <span className="text-[var(--mc-color-text-secondary)]">Contraseña (mín. 6)</span>
          <input
            type="password"
            className="rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] px-3 py-2"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={6}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
      <p className="mt-4 text-center text-[var(--mc-text-sm)] text-[var(--mc-color-text-secondary)]">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-[var(--mc-color-accent)]">
          Entrar
        </Link>
      </p>
      </div>
    </div>
  );
}
