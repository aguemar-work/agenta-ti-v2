/**
 * hooks/useSemanaNavegacion.ts
 *
 * Maneja navegación de semana, modo Hoy/Semana y selector de usuario (jefe).
 * Extraído de useMiSemanaPage para reducir su tamaño y separar responsabilidades.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { useUsuariosParaSelector } from '@/hooks/useTareas';
import { fechaLocalYmd } from '@/lib/fecha';
import { agregarDias, inicioSemanaIso, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import { useVistaStore } from '@/store/vistaStore';
import { getObjetivosActivos } from '@/api/objetivos';

// ---------------------------------------------------------------------------
// Persistencia del modo Hoy/Semana en localStorage
// ---------------------------------------------------------------------------
const LS_KEY = 'mc-modo-semana';

function modoInicial(): 'hoy' | 'semana' {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'hoy' || saved === 'semana') return saved;
  } catch { /* localStorage no disponible */ }
  const dow = new Date().getDay();
  return dow >= 1 && dow <= 4 ? 'hoy' : 'semana';
}

// ---------------------------------------------------------------------------

export function useSemanaNavegacion() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';

  // ── Modo Hoy / Semana ─────────────────────────────────────────────────────
  const [modo, setModoState] = useState<'hoy' | 'semana'>(modoInicial);

  function setModo(m: 'hoy' | 'semana') {
    try { localStorage.setItem(LS_KEY, m); } catch { /* ignorar */ }
    setModoState(m);
  }

  const esModoHoy       = modo === 'hoy';
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

  const { data: usuariosJefe }          = useUsuariosParaSelector(Boolean(esJefe));
  const { data: usuariosAsignables = [] } = useUsuariosActivos();

  // ── Objetivos activos (necesarios en varios modales) ──────────────────────
  const { data: objetivosActivos = [] } = useQuery({
    queryKey: ['objetivos-activos-mi-semana'],
    queryFn:  () => getObjetivosActivos(),
  });

  return {
    // Auth
    usuario, esJefe,

    // Modo
    modo, setModo, esModoHoy, esBannerViernes,

    // Semana
    lunes, setLunes, sabado, diasSemana, semanaISO, hoyYmd,

    // Usuario seleccionado
    uid, seleccionId, setSeleccionId,
    usuariosJefe, usuariosAsignables, objetivosActivos,
  };
}