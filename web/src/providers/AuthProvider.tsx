import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';

import { asegurarUsuario } from '@/api/usuario';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';
import { useVistaStore } from '@/store/vistaStore';

type Props = { children: ReactNode };

export function AuthProvider({ children }: Props) {
  const setAuth    = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clear      = useAuthStore((s) => s.clear);
  const onClear    = useAuthStore((s) => s.onClear);

  // Registrar suscripción: cuando authStore haga clear(), resetear vistaStore.
  // La responsabilidad de saber quién resetear vive aquí, no en el store.
  useEffect(() => {
    const unsub = onClear(() => {
      useVistaStore.getState().reset();
    });
    return unsub;
  }, [onClear]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    const insforge = getInsforge();
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data.user) {
      clear();
      setLoading(false);
      return;
    }
    try {
      const usuario = await asegurarUsuario(data.user);
      setAuth(data.user, usuario);
    } catch (err) {
      console.error('[bootstrap]', err);
      clear();
      setLoading(false);
    }
  }, [clear, setAuth, setLoading]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return children;
}
