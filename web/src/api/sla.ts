import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';

const ResumenSlaJefeSchema = z.object({
  atrasadas_activas:    z.number(),
  atrasadas_nuevas_24h: z.number(),
  bloqueadas_criticas:  z.number(),
  fecha:                z.string(),
});

export type ResumenSlaJefe = z.infer<typeof ResumenSlaJefeSchema>;

const FALLBACK_RESUMEN: ResumenSlaJefe = {
  atrasadas_activas:    0,
  atrasadas_nuevas_24h: 0,
  bloqueadas_criticas:  0,
  fecha:                '',
};

/** Contadores SLA del equipo (solo jefe; RPC mig. 029). */
export async function getResumenSlaJefe(): Promise<ResumenSlaJefe> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database.rpc('sgtd_resumen_sla_jefe');
  if (error) throw error;

  const parsed = ResumenSlaJefeSchema.safeParse(data);
  return parsed.success ? parsed.data : FALLBACK_RESUMEN;
}

/** Alertas SLA que requieren atención del jefe (nuevas 24h + bloqueadas >48h). */
export function contarAlertasSla(resumen: ResumenSlaJefe): number {
  return resumen.atrasadas_nuevas_24h + resumen.bloqueadas_criticas;
}
