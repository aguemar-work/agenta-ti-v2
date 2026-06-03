import { describe, expect, it, vi } from 'vitest';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { buildOTDetalleAcciones } from '@/lib/otDetalleAcciones';

const HANDLERS = {
  onAprobar: vi.fn(),
  onRechazar: vi.fn(),
  onIniciar: vi.fn(),
  onCompletar: vi.fn(),
  onEditar: vi.fn(),
  onCancelar: vi.fn(),
  onImprimir: vi.fn(),
};

const UID_CREADOR = '11111111-1111-1111-1111-111111111111';
const UID_OTRO    = '22222222-2222-2222-2222-222222222222';

function ot(partial: Partial<OrdenTrabajo>): OrdenTrabajo {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    numero: 'OT-001',
    creado_por: UID_CREADOR,
    tipo_trabajo_id: null,
    tarea_id: null,
    objetivo_id: null,
    estado: 'en_ejecucion',
    prioridad: 'normal',
    descripcion: 'Test',
    area_destino: 'TI',
    ubicacion: null,
    modalidad: 'presencial',
    fecha_estimada: '2026-06-01',
    hora_inicio_est: null,
    duracion_est_min: null,
    equipos_materiales: null,
    observaciones: null,
    aprobado_por: null,
    fecha_aprobacion: null,
    motivo_rechazo: null,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    observaciones_cierre: null,
    receptor_nombre: null,
    receptor_dni: null,
    receptor_cargo: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...partial,
  };
}

describe('buildOTDetalleAcciones', () => {
  it('jefe puede completar OT en ejecución', () => {
    const a = buildOTDetalleAcciones(ot({ estado: 'en_ejecucion' }), true, UID_OTRO, HANDLERS);
    expect(a.puedeCompletar).toBe(true);
    expect(a.puedeIniciar).toBe(false);
  });

  it('miembro creador puede iniciar en aprobada pero no completar', () => {
    const a = buildOTDetalleAcciones(ot({ estado: 'aprobada' }), false, UID_CREADOR, HANDLERS);
    expect(a.puedeIniciar).toBe(true);
    expect(a.puedeCompletar).toBe(false);
  });

  it('miembro no creador no ve iniciar ni completar', () => {
    const a = buildOTDetalleAcciones(ot({ estado: 'en_ejecucion' }), false, UID_OTRO, HANDLERS);
    expect(a.puedeIniciar).toBe(false);
    expect(a.puedeCompletar).toBe(false);
  });

  it('creador completa solo en ejecución', () => {
    const a = buildOTDetalleAcciones(ot({ estado: 'en_ejecucion' }), false, UID_CREADOR, HANDLERS);
    expect(a.puedeCompletar).toBe(true);
  });
});
