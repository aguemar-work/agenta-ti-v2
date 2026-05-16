import { describe, expect, it } from 'vitest';

import {
  formInicialOT,
  normalizarFormOTParaGuardar,
  ordenTrabajoToForm,
  tieneContenidoBorrador,
} from '@/lib/otFormDraft';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';

const UID = 'user-1';

describe('otFormDraft', () => {
  it('detecta contenido distinto al formulario vacío', () => {
    const vacio = formInicialOT(UID);
    expect(tieneContenidoBorrador(vacio, vacio)).toBe(false);
    expect(tieneContenidoBorrador({ ...vacio, descripcion: 'Cableado' }, vacio)).toBe(true);
  });

  it('rellena campos obligatorios al autoguardar', () => {
    const vacio = formInicialOT(UID);
    const out = normalizarFormOTParaGuardar(vacio, UID);
    expect(out.enviar).toBe(false);
    expect(out.descripcion).toBe('(borrador)');
    expect(out.area_destino).toBe('(pendiente)');
    expect(out.fecha_estimada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('oculta placeholders al hidratar desde servidor', () => {
    const ot = {
      id: 'ot-1',
      creado_por: UID,
      descripcion: '(borrador)',
      area_destino: '(pendiente)',
      fecha_estimada: '2026-05-20',
      modalidad: 'presencial',
      tipo_trabajo_id: null,
      tarea_id: null,
      objetivo_id: null,
      ubicacion: null,
      hora_inicio_est: null,
      duracion_est_min: null,
      equipos_materiales: null,
      observaciones: null,
      prioridad: 'normal',
    } as OrdenTrabajo;
    const form = ordenTrabajoToForm(ot);
    expect(form.descripcion).toBe('');
    expect(form.area_destino).toBe('');
  });
});
