/**
 * Matriz UI (permisos.ts) ↔ enforcement en PostgreSQL (RLS + RPC).
 * Fuente de verdad de BD: db/schema.sql, db/migrations/005, 007, 023, 031.
 *
 * El frontend solo oculta CTAs; cualquier cliente con JWT válido queda acotado por RLS.
 */

export type CapaEnforcement = 'rls' | 'rpc' | 'rls+rpc';

export interface ReglaPermisoBackend {
  accion: string;
  ui: string;
  capa: CapaEnforcement;
  detalle: string;
}

/** Paridad esperada entre puedeGestionarTarea / JefeRoute y el servidor. */
export const REGLAS_PERMISO_BACKEND: readonly ReglaPermisoBackend[] = [
  {
    accion: 'Ver/editar cualquier tarea',
    ui: 'puedeGestionarTarea → jefe',
    capa: 'rls',
    detalle: 'Política sgtd_jefe_tarea_all (FOR ALL) vía sgtd_es_jefe().',
  },
  {
    accion: 'Ver/editar tarea propia',
    ui: 'puedeGestionarTarea → miembro asignado',
    capa: 'rls',
    detalle: 'sgtd_miembro_tarea_* exige asignado_a = auth.uid() y creado_por en INSERT.',
  },
  {
    accion: 'Modificar tarea ajena (miembro)',
    ui: 'UI readOnly',
    capa: 'rls',
    detalle: 'UPDATE/DELETE denegado si asignado_a ≠ auth.uid(); RPCs validan auth.uid().',
  },
  {
    accion: 'Bloquear / reprogramar / eliminar con log',
    ui: 'Modales + RPC',
    capa: 'rpc',
    detalle: 'sgtd_bloquear_tarea_con_log, sgtd_reprogramar_tarea_con_log, sgtd_eliminar_tarea_con_motivo.',
  },
  {
    accion: 'Rutas /planificacion y /metricas',
    ui: 'JefeRoute',
    capa: 'rls',
    detalle: 'RLS no restringe rutas HTTP; datos sensibles filtrados por rol en consultas + políticas.',
  },
  {
    accion: 'Aprobar / rechazar OT',
    ui: 'selectEsJefe',
    capa: 'rpc',
    detalle: 'sgtd_aprobar_ot / sgtd_rechazar_ot exigen sgtd_es_jefe().',
  },
  {
    accion: 'Auto-provisionar o promover rol',
    ui: 'asegurarUsuario → rol miembro',
    capa: 'rls',
    detalle: 'Trigger trg_sgtd_proteger_rol_usuario: solo jefe activo puede asignar rol ≠ miembro.',
  },
  {
    accion: 'Ver notas del equipo (visibilidad todos)',
    ui: 'PanelNotas / getNotasBitacoraRecientes',
    capa: 'rls',
    detalle: 'sgtd_miembro_nota_select (031): propias + visibilidad=todos; solo_jefe/privado ajenas ocultas.',
  },
] as const;
