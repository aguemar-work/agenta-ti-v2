/**
 * hooks/useSemanaNavegacion.ts
 *
 * Maneja navegación de semana y selector de usuario (jefe).
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { useUsuariosParaSelector } from '@/hooks/useTareas';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { fechaLocalYmd } from '@/lib/fecha';
import { qkWsId } from '@/lib/queryKeys';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useVistaStore } from '@/store/vistaStore';
import { getObjetivosActivos } from '@/api/objetivos';

export function useSemanaNavegacion() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = useWorkspaceStore((s) => s.esJefe());

  // ── Banner viernes ────────────────────────────────────────────────────────
  const esBannerViernes = new Date().getDay() === 5;

  // ── Navegación de semana ──────────────────────────────────────────────────
  const [lunes, setLunes] = useState(() => inicioSemanaIso(new Date()));

  const diasSemana = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 6; i++) out.push(agregarDias(lunes, i));
    return out;
  }, [lunes]);

  const sabado    = useMemo(() => agregarDias(lunes, 5), [lunes]);
  const semanaISO = semanaIsoDesdeFecha(lunes);
  const hoyYmd    = fechaLocalYmd(new Date());

  // ── Selector de usuario (jefe cambia de quién ve la semana) ───────────────
  const seleccionIdStore    = useVistaStore((s) => s.seleccionId);
  const setSeleccionIdStore = useVistaStore((s) => s.setSeleccionId);

  const seleccionId    = seleccionIdStore ?? usuario?.id;
  const setSeleccionId = (id: string) => { setSeleccionIdStore(id); };
  const uid            = seleccionId;

  const { data: usuariosJefe }           = useUsuariosParaSelector(Boolean(esJefe));
  const { data: usuariosAsignables = [] } = useUsuariosActivos();
  const workspaceId = useWorkspaceId();

  // ── Objetivos activos ─────────────────────────────────────────────────────
  const { data: objetivosActivos = [] } = useQuery({
    queryKey: qkWsId(workspaceId, 'objetivos-activos-mi-semana'),
    enabled: Boolean(workspaceId),
    queryFn:  () => getObjetivosActivos(),
  });

  return {
    usuario, esJefe,
    esBannerViernes,
    lunes, setLunes, sabado, diasSemana, semanaISO, hoyYmd,
    uid, seleccionId, setSeleccionId,
    usuariosJefe, usuariosAsignables, objetivosActivos,
  };
}