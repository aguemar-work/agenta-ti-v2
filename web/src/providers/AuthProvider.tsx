import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';

import { asegurarUsuario } from '@/api/usuario';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';
import { useVistaStore } from '@/store/vistaStore';

type Props = { children: ReactNode };

// Verifica la sesión cada 4 minutos.
// Si el token expiró o el usuario fue desactivado, cierra sesión automáticamente.
const SESSION_CHECK_INTERVAL_MS = 4 * 60 * 1000;

export function AuthProvider({ children }: Props) {
  const setAuth    = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);
  const clear      = useAuthStore((s) => s.clear);
  const onClear    = useAuthStore((s) => s.onClear);

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

  // Carga inicial
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Verificación periódica de sesión.
  // InsForge no tiene onAuthStateChange, así que consultamos
  // getCurrentUser() cada 4 minutos. Si falla o no hay usuario → logout.
  useEffect(() => {
    const id = setInterval(async () => {
      const { data, error } = await getInsforge().auth.getCurrentUser();
      if (error || !data.user) {
        clear();
      }
    }, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [clear]);

  return children;
}