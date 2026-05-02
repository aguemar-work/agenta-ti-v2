/**
 * hooks/useRealtimeNotificaciones.ts
 *
 * Escucha eventos en tiempo real y dispara toasts según el rol del usuario.
 * Incluye retry con exponential backoff y estado de conexión observable.
 *
 * Canales:
 *   usuario:{id}   — eventos dirigidos a un usuario específico
 *   equipo:{id}    — eventos del equipo (solo jefes)
 *
 * Eventos:
 *   tarea_completada      → { tareaId, titulo, usuarioNombre }
 *   tarea_asignada        → { tareaId, titulo, asignadoPor }
 *   ot_enviada            → { otId, numero, usuarioNombre }
 *   ot_aprobada           → { otId, numero }
 *   ot_rechazada          → { otId, numero, motivo }
 *   incidencia_registrada → { titulo, usuarioNombre }
 *
 * Uso:
 *   const { conectado } = useRealtimeNotificaciones();
 *   // conectado: true = realtime activo, false = sin conexión
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Q_INC_HOY } from '@/hooks/useHoyColumnas';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';

type EventPayload = Record<string, unknown>;

// Configuración de retry
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000]; // 3 intentos: 2s, 4s, 8s
const MAX_RETRIES = RETRY_DELAYS_MS.length;

export function useRealtimeNotificaciones() {
  const usuario = useAuthStore((s) => s.usuario);
  const qc      = useQueryClient();

  const [conectado, setConectado] = useState(false);

  const cancelledRef  = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;

    cancelledRef.current  = false;
    retryCountRef.current = 0;

    const rt          = getInsforge().realtime;
    const esJefe      = usuario.rol === 'jefe';
    const canalUser   = `usuario:${usuario.id}`;
    const canalEquipo = `equipo:${usuario.id}`;

    async function connect() {
      if (cancelledRef.current) return;

      try {
        await rt.connect();
        if (cancelledRef.current) return;

        // Conexión exitosa — resetear contador de retries
        retryCountRef.current = 0;
        setConectado(true);

        // ── Canal personal ─────────────────────────────────────────────
        await rt.subscribe(canalUser);

        rt.on('tarea_asignada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          toast.info(`Nueva tarea asignada: ${payload.titulo ?? ''}`);
        });

        rt.on('ot_aprobada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          toast.success(`OT ${payload.numero ?? ''} aprobada ✓`);
        });

        rt.on('ot_rechazada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          toast.error(`OT ${payload.numero ?? ''} rechazada${payload.motivo ? `: ${payload.motivo}` : ''}`);
        });

        // ── Canal del equipo (solo Jefe) ───────────────────────────────
        if (esJefe) {
          await rt.subscribe(canalEquipo);

          rt.on('tarea_completada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            void Promise.all([
              qc.invalidateQueries({ queryKey: ['tablero'],      exact: false }),
              qc.invalidateQueries({ queryKey: ['semana'],       exact: false }),
              qc.invalidateQueries({ queryKey: ['tareas-hoy'],   exact: false }),
              qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
            ]);
            toast.success(
              `${payload.usuarioNombre ?? 'Miembro'} completó "${payload.titulo ?? ''}"`,
              { description: payload.resumen ? String(payload.resumen).slice(0, 120) : undefined },
            );
          });

          rt.on('ot_enviada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            toast.info(
              `Nueva OT de ${payload.usuarioNombre ?? 'Miembro'}`,
              { description: `${payload.numero ?? ''} — pendiente de aprobación` },
            );
          });

          rt.on('incidencia_registrada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            void Promise.all([
              qc.invalidateQueries({ queryKey: [Q_INC_HOY],      exact: false }),
              qc.invalidateQueries({ queryKey: ['tablero'],       exact: false }),
              qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
            ]);
            toast.warning(
              `Incidencia: ${payload.titulo ?? ''}`,
              { description: `Registrada por ${payload.usuarioNombre ?? ''}` },
            );
          });
        }
      } catch (err) {
        if (cancelledRef.current) return;

        setConectado(false);
        console.warn('[useRealtimeNotificaciones] connect error:', err);

        // Retry con exponential backoff si quedan intentos
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[retryCountRef.current] ?? 8_000;
          retryCountRef.current += 1;
          console.warn(
            `[useRealtimeNotificaciones] reintentando en ${delay}ms (intento ${retryCountRef.current}/${MAX_RETRIES})`,
          );
          retryTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) void connect();
          }, delay);
        }
        // Después de MAX_RETRIES la app sigue funcionando sin realtime
      }
    }

    void connect();

    return () => {
      cancelledRef.current = true;

      // Cancelar retry pendiente si existe
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      setConectado(false);

      try {
        rt.unsubscribe(canalUser);
        if (esJefe) rt.unsubscribe(canalEquipo);
        rt.disconnect();
      } catch {
        // ignorar errores de cleanup
      }
    };
  }, [qc, usuario?.id, usuario?.rol]);

  return { conectado };
}