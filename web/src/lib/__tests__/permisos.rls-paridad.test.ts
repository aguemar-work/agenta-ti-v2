/**
 * Documenta paridad UI ↔ backend. Falla si alguien elimina reglas RLS del mapa.
 */
import { describe, expect, it } from 'vitest';

import { REGLAS_PERMISO_BACKEND } from '@/lib/permisosBackend';

describe('permisos — paridad con RLS/RPC', () => {
  it('define al menos las acciones críticas de tarea y OT', () => {
    const acciones = REGLAS_PERMISO_BACKEND.map((r) => r.accion);
    expect(acciones).toContain('Ver/editar cualquier tarea');
    expect(acciones).toContain('Modificar tarea ajena (miembro)');
    expect(acciones).toContain('Reprogramar / cancelar / eliminar con log');
    expect(acciones).toContain('Aprobar / rechazar OT');
  });

  it('cada regla declara capa rls o rpc', () => {
    for (const regla of REGLAS_PERMISO_BACKEND) {
      expect(['rls', 'rpc', 'rls+rpc']).toContain(regla.capa);
      expect(regla.detalle.length).toBeGreaterThan(10);
    }
  });
});
