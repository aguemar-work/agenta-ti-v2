/**
 * src/mocks/handlers.ts
 *
 * Handlers MSW v2 alineados con el transporte real del SDK InsForge.
 *
 * El SDK InsForge NO usa /rest/v1/ (convención Supabase estándar).
 * Transforma internamente las rutas PostgREST:
 *   - Tablas: {baseUrl}/api/database/records/{tabla}
 *   - RPCs:   {baseUrl}/api/database/rpc/{fn}
 *
 * Esto se confirma en dos lugares del código fuente del SDK:
 *   const endpoint = rpcMatch
 *     ? `/api/database/rpc/${rpcMatch[1]}`
 *     : `/api/database/records/${pathname}`;
 *
 * El interceptor de fetch (insforgeFetchInterceptor.ts) también lo confirma:
 *   isDatabasePath(url) → url.pathname.includes('/api/database/')
 *
 * NOTA: En los tests de API de este proyecto, @/lib/insforge está mockeado con
 * vi.mock(), por lo que el fetch real nunca se dispara y MSW no intercepta nada
 * en esa capa. Estos handlers son para tests de integración de nivel superior
 * (componentes o páginas) que montan el cliente real sin mockear getInsforge().
 *
 * Para tests unitarios de api/*.ts: se usa vi.mock('@/lib/insforge').
 * Para tests de componentes que usan TanStack Query + cliente real: se usa este server.
 */

import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Base URL de test — debe coincidir con VITE_INSFORGE_URL en .env.test
// ---------------------------------------------------------------------------

const BASE = 'http://test-insforge.local/api/database';

// ---------------------------------------------------------------------------
// IDs fijos para datos de prueba reproducibles
// ---------------------------------------------------------------------------

export const MOCK_IDS = {
  jefe:    'aaaaaaaa-0000-4000-a000-000000000001',
  miembro: 'bbbbbbbb-0000-4000-a000-000000000002',
  tarea1:  'cccccccc-0000-4000-a000-000000000003',
  tarea2:  'dddddddd-0000-4000-a000-000000000004',
  evento1: 'eeeeeeee-0000-4000-a000-000000000005',
  obj1:    'ffffffff-0000-4000-a000-000000000006',
  ot1:     '11111111-0000-4000-a000-000000000007',
  nota1:   '22222222-0000-4000-a000-000000000008',
} as const;

// ---------------------------------------------------------------------------
// Factories de datos de prueba
// ---------------------------------------------------------------------------

export function mockTarea(overrides: Record<string, unknown> = {}) {
  return {
    id:                 MOCK_IDS.tarea1,
    titulo:             'Tarea de prueba',
    descripcion:        null,
    estado:             'pendiente',
    tipo:               'planificada',
    prioridad:          'media',
    fecha_planificada:  '2026-04-29',
    semana_planificada: '202618',
    fecha_completada:   null,
    asignado_a:         MOCK_IDS.miembro,
    objetivo_id:        null,
    creado_por:         MOCK_IDS.miembro,
    es_imprevisto:      false,
    nota_origen_id:     null,
    created_at:         '2026-01-01T00:00:00Z',
    updated_at:         '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function mockUsuario(overrides: Record<string, unknown> = {}) {
  return {
    id:         MOCK_IDS.miembro,
    nombre:     'Kevin Miembro',
    email:      'kevin@nufago.com',
    rol:        'miembro',
    activo:     true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function mockJefe(overrides: Record<string, unknown> = {}) {
  return mockUsuario({
    id:     MOCK_IDS.jefe,
    nombre: 'Ana Jefe',
    rol:    'jefe',
    email:  'ana@nufago.com',
    ...overrides,
  });
}

export function mockObjetivo(overrides: Record<string, unknown> = {}) {
  return {
    id:             MOCK_IDS.obj1,
    titulo:         'Objetivo de prueba',
    descripcion:    null,
    fecha_limite:   null,
    estado:         'activo',
    creado_por:     MOCK_IDS.jefe,
    responsable_id: null,
    created_at:     '2026-01-01T00:00:00Z',
    updated_at:     '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function mockOT(overrides: Record<string, unknown> = {}) {
  return {
    id:                   MOCK_IDS.ot1,
    numero:               'OT-2026-001',
    creado_por:           MOCK_IDS.miembro,
    tipo_trabajo_id:      null,
    tarea_id:             null,
    objetivo_id:          null,
    estado:               'borrador',
    prioridad:            'normal',
    descripcion:          'Descripción de prueba',
    area_destino:         'Sistemas',
    ubicacion:            null,
    modalidad:            'presencial',
    fecha_estimada:       '2026-04-30',
    hora_inicio_est:      null,
    duracion_est_min:     null,
    equipos_materiales:   null,
    observaciones:        null,
    aprobado_por:         null,
    fecha_aprobacion:     null,
    motivo_rechazo:       null,
    fecha_inicio_real:    null,
    fecha_fin_real:       null,
    observaciones_cierre: null,
    receptor_nombre:      null,
    receptor_dni:         null,
    receptor_cargo:       null,
    created_at:           '2026-01-01T00:00:00Z',
    updated_at:           '2026-01-01T00:00:00Z',
    tipo_trabajo:         null,
    creador:              { nombre: 'Kevin Miembro', email: 'kevin@nufago.com' },
    aprobador:            null,
    tarea:                null,
    objetivo:             null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Handlers: Tareas  →  /api/database/records/tarea
// ---------------------------------------------------------------------------

export const tareaHandlers = [
  http.get(`${BASE}/records/tarea`, () =>
    HttpResponse.json([mockTarea()]),
  ),

  // RPCs de tarea → /api/database/rpc/{fn}
  http.post(`${BASE}/rpc/sgtd_crear_tarea_planificada`, () =>
    HttpResponse.json([mockTarea()]),
  ),
  http.post(`${BASE}/rpc/sgtd_cambiar_estado_tarea`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_eliminar_tarea_con_motivo`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_reprogramar_tarea_con_log`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_mover_tarea_dia`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_mover_tarea_columna`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_snap_tarea_hoy`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_convertir_nota_en_tarea`, () =>
    HttpResponse.json(MOCK_IDS.tarea1),
  ),
  http.post(`${BASE}/rpc/sgtd_convertir_nota_en_evento`, () =>
    HttpResponse.json(MOCK_IDS.evento1),
  ),

  // PATCH tabla tarea (actualizarTarea)
  http.patch(`${BASE}/records/tarea`, () =>
    HttpResponse.json([mockTarea({ titulo: 'Tarea actualizada' })]),
  ),
];

// ---------------------------------------------------------------------------
// Handlers: Eventos  →  /api/database/records/evento
// ---------------------------------------------------------------------------

export const eventoHandlers = [
  http.get(`${BASE}/records/evento`, () =>
    HttpResponse.json([]),
  ),
  http.post(`${BASE}/records/evento`, () =>
    HttpResponse.json({
      id:            MOCK_IDS.evento1,
      titulo:        'Reunión de prueba',
      tipo:          'reunion',
      fecha_inicio:  '2026-04-29T09:00:00.000Z',
      fecha_fin:     '2026-04-29T10:00:00.000Z',
      usuario_id:    MOCK_IDS.miembro,
      es_recurrente: false,
      created_at:    '2026-01-01T00:00:00Z',
      updated_at:    '2026-01-01T00:00:00Z',
    }),
  ),
  http.patch(`${BASE}/records/evento`, () =>
    HttpResponse.json({}),
  ),
  http.delete(`${BASE}/records/evento`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];

// ---------------------------------------------------------------------------
// Handlers: Objetivos  →  /api/database/records/objetivo
// ---------------------------------------------------------------------------

export const objetivoHandlers = [
  http.get(`${BASE}/records/objetivo`, () =>
    HttpResponse.json([mockObjetivo()]),
  ),
  http.post(`${BASE}/records/objetivo`, () =>
    HttpResponse.json(mockObjetivo()),
  ),
  http.patch(`${BASE}/records/objetivo`, () =>
    HttpResponse.json(mockObjetivo({ titulo: 'Objetivo actualizado' })),
  ),
  http.post(`${BASE}/rpc/sgtd_completar_objetivo`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_eliminar_objetivo_con_motivo`, () =>
    HttpResponse.json(null),
  ),
];

// ---------------------------------------------------------------------------
// Handlers: Órdenes de Trabajo  →  /api/database/records/orden_trabajo
// ---------------------------------------------------------------------------

export const ordenTrabajoHandlers = [
  http.get(`${BASE}/records/orden_trabajo`, () =>
    HttpResponse.json([mockOT()]),
  ),
  http.post(`${BASE}/records/orden_trabajo`, () =>
    HttpResponse.json(mockOT()),
  ),
  http.patch(`${BASE}/records/orden_trabajo`, () =>
    HttpResponse.json(mockOT({ estado: 'pendiente' })),
  ),

  // Tipos de trabajo (tabla auxiliar)
  http.get(`${BASE}/records/tipo_trabajo_ot`, () =>
    HttpResponse.json([{
      id:         '00000000-0000-4000-a000-000000000099',
      nombre:     'MANTENIMIENTO',
      activo:     true,
      created_at: '2026-01-01T00:00:00Z',
    }]),
  ),

  // RPCs de OT
  http.post(`${BASE}/rpc/sgtd_aprobar_ot`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_rechazar_ot`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_enviar_ot`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_completar_ot`, () =>
    HttpResponse.json(null),
  ),
  http.post(`${BASE}/rpc/sgtd_cancelar_ot`, () =>
    HttpResponse.json(null),
  ),
];

// ---------------------------------------------------------------------------
// Handlers: Usuarios  →  /api/database/records/usuario
// ---------------------------------------------------------------------------

export const usuarioHandlers = [
  http.get(`${BASE}/records/usuario`, () =>
    HttpResponse.json([mockUsuario(), mockJefe()]),
  ),
  http.post(`${BASE}/records/usuario`, () =>
    HttpResponse.json(mockUsuario()),
  ),
  http.patch(`${BASE}/records/usuario`, () =>
    HttpResponse.json(mockUsuario()),
  ),
];

// ---------------------------------------------------------------------------
// Handler de error 401 para tests del interceptor
// ---------------------------------------------------------------------------

/**
 * Devuelve un handler que simula un 401 "token expirado" en la siguiente
 * petición a cualquier endpoint de base de datos.
 * Útil para testear que insforgeFetchInterceptor.ts dispara el refresh.
 *
 * Uso:
 *   server.use(mockUnauthorizedOnce());
 */
export function mockUnauthorizedOnce() {
  return http.get(`${BASE}/records/:tabla`, () =>
    HttpResponse.json(
      { message: 'jwt expired', error: 'Unauthorized' },
      { status: 401 },
    ),
    { once: true },
  );
}

// ---------------------------------------------------------------------------
// Export agrupado
// ---------------------------------------------------------------------------

export const handlers = [
  ...tareaHandlers,
  ...eventoHandlers,
  ...objetivoHandlers,
  ...ordenTrabajoHandlers,
  ...usuarioHandlers,
];
