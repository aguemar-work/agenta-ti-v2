Auditoría Ejecutiva Unificada — Nexora SGTD
Versión: Consolidada (Auditoría Estratégica + Auditoría v3)
Fecha: 16 de mayo de 2026
Rol de Auditoría: Chief Digital Auditor (CTO, CFO, Product, UX, Performance)
Versión auditada: agenda-ti_v3 · SPA React 19 + InsForge (PostgreSQL/RLS)

📌 INFORMACIÓN DEL PROYECTO (CONTEXTO EJECUTIVO)
Tipo de plataforma: SPA de gestión interna (Sistema de Gestión de Tareas Departamental / ITSM).

Objetivo principal: Eficiencia operativa del equipo IT. Gestionar planificación semanal, ejecución, órdenes de trabajo (OT) y visibilidad de métricas directivas.

Flujo crítico de negocio: Planificación semanal continua, ejecución sin pérdida de estado y reporte veraz del esfuerzo de IT.

Stack tecnológico: React 19, Vite 8, TanStack Query 5, Zustand, Zod 4. Backend: InsForge (Postgres, RLS). UI: Meta Canvas.

Competidores referentes: Asana, Jira Service Management, Monday.com.

Modelo de ingresos: Ahorro de costes directos, eliminación de licencias SaaS comerciales, aumento de productividad.

1. RESUMEN EJECUTIVO
Estado general: 🟡 En riesgo moderado. El sistema posee fundaciones técnicas sólidas, pero acumula bugs críticos en producción no resueltos, deuda de UX y una falta total de observabilidad que convierten cada despliegue en un riesgo no cuantificado y ponen en peligro la adopción y la integridad de los datos de gestión.

Top 3 problemas con mayor impacto financiero HOY:

Bug B-01/B-03 en producción: La eliminación de tareas falla y las tareas reprogramada no se marcan atrasada automáticamente. Impacto: Los jefes de IT toman decisiones sobre métricas y KPIs incorrectos.
Cero observabilidad en producción: Sentry no está configurado. Impacto: Fallos silenciosos en flujos críticos (OT, DnD) no se detectan hasta que un usuario reporta. El tiempo medio de resolución (MTTR) es indefinido.
Pérdida de borradores de Órdenes de Trabajo (OT) / QA sin ejecutar: Los borradores solo residen en memoria local y el checklist de 27 escenarios de QA no se ha ejecutado. Impacto: Riesgo de pérdida de trabajo y de que defectos en el flujo crítico de OT lleguen a producción sin ser detectados.
Top 3 oportunidades de mayor ROI inmediato:

Aplicar la migración 027 y ejecutar la función de base de datos para corregir el estado de las tareas.
Activar Sentry con su DSN y configurar alertas básicas de error.
Restaurar la persistencia en servidor de los borradores de OT y ejecutar el checklist de QA completo.
Deuda técnica estimada: Media-Alta (27 migraciones de BD en semanas, módulos eliminados con posibles referencias residuales, ausencia de métricas de cobertura de pruebas y CI/CD no estandarizado).

Brecha competitiva principal: Ausencia de aplicación móvil, notificaciones push y automatización proactiva de alertas, en contraste con herramientas top-tier como Asana y Jira.

2. DECISION LAYER ⭐
Categoría	Hallazgos
✅ HACER AHORA	[D4-01] Aplicar migración 027 + sgtd_marcar_atrasadas_vencidas() en producción.
[D1-01] Configurar VITE_SENTRY_DSN y alertas básicas en producción.
[D4-01] Restaurar persistencia en servidor para borradores de OT.
[D2-01] Ejecutar el checklist de QA manual completo.
[D2-01] Solucionar bloqueos críticos de layout (Sticky en Planificación, overflow en Semana).
[D1-02] Asegurar que node_modules no se incluya en el versionado/build.
📅 PLANIFICAR	[D1-04] Pipeline de CI/CD básico (lint, test, build, deploy).
[D1-05] Configurar reporte de cobertura de pruebas con umbral mínimo del 70%.
[D1-02] Refactorización incremental a arquitectura "feature-sliced" (src/features).
[D4-02] Implementar motor de automatización básico (alertas de tareas atrasadas / SLA).
[D1-03] Implementar PWA con soporte offline para lectura.
[D2-02] Validar y corregir funcionalidad Drag & Drop táctil en móviles.
⏸️ POSPONER	Soporte Multi-Tenant / Multi-Área (hasta validar éxito en IT).
Integración con calendarios externos (Outlook/Google).
Desarrollo de App Nativa (la PWA puede cumplir la función inicial).
❌ NO HACER	Reestructuración del backend (InsForge + RLS es sólido y cumple su propósito).
Reintroducir el módulo /tablero kanban (eliminado por decisión arquitectónica).
Migrar a Tailwind v4 (explícitamente incompatible con el flujo InsForge MCP).
3. HALLAZGOS UNIFICADOS POR DIMENSIÓN
D1 — ARQUITECTURA Y PERFORMANCE
[D1-01] 🔴 Observabilidad inexistente en producción
Hallazgo unificado: No hay captura de errores en producción. VITE_SENTRY_DSN no está configurado. No existen logs, métricas de rendimiento ni alertas. El RAR del proyecto incluye node_modules, señal de un proceso de build artesanal y no estandarizado.

Impacto negocio: Fallos en flujos críticos pasan completamente desapercibidos. El MTTR es indefinido.

Solución consolidada:

Crear proyecto en Sentry, configurar DSN en producción e inicializar en el bootstrap de la app.
Configurar alerta de error rate > 1%.
Configurar un pipeline CI/CD básico (GitHub Actions/Vercel) con npm ci && npm run build para asegurar builds limpios y reproducibles.
Esfuerzo: 1 día (Sentry: 2h, CI/CD: 6h).

Validación: Error intencional aparece en dashboard de Sentry. Build desde CI limpio es exitoso.

[D1-02] Monolitos de Cliente (Hooks de Página)
Hallazgo unificado: Páginas completas dependen de mega-hooks (ej. useMiSemanaPage), mezclando lógica de UI, estado y mutaciones. Esto dificulta el testing unitario y ralentiza el desarrollo de nuevas features.

Solución: Refactorización incremental hacia una arquitectura src/features/ con separación de responsabilidades (domain logic, state, queries).

Esfuerzo: 5 días.

Validación: El hook principal de un módulo refactorizado no supera las 150 líneas y sus mutaciones complejas tienen tests unitarios aislados.

[D1-03] Sin capacidades offline (PWA)
Hallazgo unificado: La SPA no funciona sin conexión, lo que limita su uso en campo (ej. técnicos en modalidad: viaje).

Solución: Implementar vite-plugin-pwa con una estrategia StaleWhileRevalidate para lecturas y caché de OTs y tareas propias en IndexedDB.

Esfuerzo: 3 días.

[D1-04] Cobertura de pruebas sin métricas
Hallazgo unificado: Los tests existen, pero el directorio coverage/ está vacío (0 bytes). No hay métricas disponibles para medir la cobertura del código crítico.

Solución: Configurar correctamente el reporter de coverage (lcov, text) en Vitest.config.ts y establecer umbrales mínimos (líneas: 70%, ramas: 60%).

Esfuerzo: 4h.

[D1-05] Stack tecnológico coherente
Evaluación unificada (positiva): La elección de React 19, Vite 8, TanStack Query, Zod e InsForge (Postgres + RLS) es moderna, coherente y sólida para un equipo sin backend dedicado.

Riesgo: Vendor lock-in con InsForge. Se debe documentar un plan de contingencia.

D2 — UX/UI Y FLUJOS DE USUARIO
[D2-01] 🔴 Fricciones operativas y QA sin ejecutar
Hallazgo unificado: Se combinan problemas técnicos de UI con la falta de validación de calidad.

Layout de Tablas: Falta position: sticky en la columna de recursos de "Planificación" y manejo de overflow en la grilla de "Mi Semana".

Drawer de Notas: Carece de manejo de teclado (cierre con Escape, foco atrapado).

Checklist de QA: Los 27 escenarios de QA manual (auth, OT, DnD, accesibilidad) no se han ejecutado, dejando flujos críticos sin verificar antes del release actual. El escenario O4 ("Miembro intenta aprobar OT") es un riesgo de seguridad activo.

Solución consolidada:

UI Crítica (1 día): Implementar sticky, corregir overflow, y añadir Escape + trap focus al Drawer.
QA Manual (4h): Ejecutar y registrar el resultado de los 27 escenarios, priorizando los críticos (A1-A5, O1-O4, D4).
Validación: Pantalla de 13" con datos densos es usable; Drawer responde a Escape; checklist de QA con todos los ítems verificados y 0 en estado "FAIL".

[D2-02] Drag & Drop táctil y otros
Hallazgo unificado: Se consolida la deuda de UX secundaria.

DnD Táctil: No se ha validado en dispositivos reales. Requiere configuración explícita de TouchSensor en @dnd-kit.

Deuda de Consistencia Visual: Colores "quemados" (códigos #hex directos) en lugar de tokens semánticos y múltiples implementaciones de componentes simples (KpiCard, EmptyStates).

Solución:

Verificar y configurar sensores táctiles en useSemanaDnD.ts.

Unificar componentes base y migrar a tokens del sistema de diseño (--mc-*).

Esfuerzo: 2-3 días.

Validación: QA D5 ✅ PASS en iOS y Android. Búsqueda de #hex en código fuente devuelve 0 resultados.

D3 — PERFORMANCE DE CARGA (Ex-SEO)
Contexto: Dado que Nexora es una app interna, la dimensión de "SEO" de la auditoría estratégica se reorienta a Performance de Carga y Métricas de Core Web Vitals.

[D3-01] Core Web Vitals sin baseline y assets sin optimizar
Hallazgo unificado: No se ha medido el baseline de LCP/CLS/INP. Los assets son mejorables (logo = 118KB PNG) y no se usan formatos modernos (WebP).

Solución: Ejecutar Lighthouse en staging con throttling "Slow 4G" para obtener el baseline. Optimizar imágenes a formato WebP y tamaños responsive.

Esfuerzo: 4h.

Validación: Lighthouse LCP < 2.5s en rutas clave. Peso total de imágenes reducido en >100KB.

D4 — LÓGICA DE NEGOCIO Y FLUJOS CRÍTICOS
[D4-01] 🔴 Bugs de producción activos (B-01/B-03) y pérdida de borradores
Hallazgo unificado: Se consolida el riesgo de integridad de datos y pérdida de información.

Bugs DB: El RPC sgtd_eliminar_tarea_con_log falla con tareas atrasada. El trigger de BD no marca como atrasada las tareas en estado reprogramada cuya fecha ya venció.

Borradores de OT: El estado del formulario de OT se pierde al cerrar el navegador o expirar la sesión, ya que solo persiste en memoria local.

Solución consolidada:

Bugs DB (30 min): Aplicar migración 027 y ejecutar sgtd_marcar_atrasadas_vencidas() en producción.
Persistencia de OT (2 días): Implementar autoguardado server-side con un flag enviar: false (o similar) para los borradores.
Validación: Una tarea reprogramada con fecha pasada cambia a atrasada. Un borrador de OT sobrevive a un refresco de página (F5).

[D4-02] Falta de automatización proactiva (SLAs)
Hallazgo unificado: El sistema es reactivo; no alerta automáticamente sobre tareas atrasadas o bloqueadas. Los líderes actúan sobre hechos consumados en la reunión semanal.

Solución: Implementar un Cron Job o Edge Function que detecte y escale automáticamente las tareas cuyo SLA se ha roto.

Esfuerzo: 3-4 días.

[D4-03] Validación de datos en OT
Hallazgo unificado: El modelo de datos es robusto, pero no se fuerza una restricción crítica a nivel de base de datos: una OT completada podría, en teoría, no tener receptor_nombre o receptor_dni, datos obligatorios para una auditoría formal.

Solución: Añadir un CHECK constraint en una nueva migración para asegurar que una OT en estado completada SIEMPRE tenga datos de receptor.

Esfuerzo: 2h.

[D4-04] Funcionalidades nuevas y módulo Bitácora (Evaluación y Deuda)
Hallazgo unificado: Se documentan elementos positivos y riesgos de nueva funcionalidad.

(Positivo) ✅ El cálculo de progreso de objetivos con pesos por prioridad es matemáticamente correcto y tiene cobertura de tests completa.

(Positivo) ✅ La validación de justificación >= 10 caracteres se hace tanto en el cliente como en el servidor.

Módulo Bitácora: La ruta /bitacora se eliminó en V4, pero la tabla nota_bitacora con RLS sigue en la BD y los tests de QA la referencian. Se debe clarificar el estado de esta funcionalidad para limpiar la deuda.

Recurrencia de Eventos: Es una funcionalidad nueva (migraciones 025-026) que carece de tests de integración/API para cubrir sus casos de error.

Acción: Clarificar el estado de la bitácora. Añadir tests de API para la recurrencia de eventos.

D5 — ESTRATEGIA FINANCIERA Y COMPETITIVA
[D5-01] Benchmark y Posicionamiento
Hallazgo unificado (Positivo): La principal ventaja competitiva de Nexora es el flujo de OT formal con receptor (nombre, DNI, cargo), una funcionalidad que las herramientas genéricas no tienen de forma nativa.

Brecha principal: La falta de app móvil, notificaciones push y automatización es un bloqueador para la adopción en equipos de TI en campo y compite en desventaja con Asana/Monday/Jira.

Modelo de Adopción: Sin analytics de comportamiento activados, el Product Strategist toma decisiones de roadmap "a ciegas", sin datos de uso real.

[D5-02] Escalabilidad
Hallazgo unificado: El stack actual (InsForge, React Query) es adecuado para un crecimiento de 5 a 50-150 usuarios. El punto de quiebre estimado es la vista de "Planificación" con muchos miembros, que podría degradarse sin paginación. Se debe verificar que las queries que alimentan esta vista tengan un LIMIT adecuado.

4. QUICK WINS UNIFICADOS
(Implementables esta semana con recursos existentes)

Aplicar migración 027 + ejecutar función SQL de corrección de estados (D4-01). (30 min)

Configurar VITE_SENTRY_DSN en producción (D1-01). (2h)

Ejecutar checklist de QA manual completo y registrar resultados (D2-01). (4h)

Solucionar bloqueos de layout (Sticky/Overflow) y accesibilidad del Drawer (D2-01). (1 día)

Re-implementar Autoguardado Server-side para Órdenes de Trabajo (D4-01). (2 días)

Unificar componentes base (KpiCard) y forzar sistema de tokens para eliminar colores #hex (D2-02). (2 días)

5. ROADMAP DE IMPLEMENTACIÓN CONSOLIDADO
Sprint	Hallazgo / Tarea	Prioridad	Esfuerzo	ROI	Responsable sugerido
1	Aplicar migración 027 y corregir datos (D4-01)	🔴	30 min	Alto	DBA / Backend
1	Configurar Sentry en producción (D1-01)	🔴	2h	Alto	DevOps / Full Stack
1	Ejecutar checklist de QA manual (D2-01)	🔴	4h	Alto	QA / Developer
1	Corregir Layout Crítico de UI (Sticky/Overflow) y Drawer (D2-01)	🔴	1 día	Alto	Frontend UI
1-2	Implementar Autoguardado Server-side para OT (D4-01)	🔴	2 días	Alto	Full Stack
2	Limpieza Visual (Tokens, KpiCard, Hex) (D2-02)	🟠	2 días	Medio	Frontend UI
2	Configurar pipeline CI/CD (D1-01) y coverage report (D1-04)	🟠	1.5 días	Alto	DevOps / Dev
2-3	Refactorización incremental de Page Hooks a features/ (D1-02)	🟠	5 días	Alto	Lead Developer
2-3	Añadir CHECK constraint para OT completada (D4-03)	🟠	2h	Alto	Backend
3	Automatización de alertas SLA / Atrasos (D4-02)	🟡	4 días	Medio	Backend Engineer
3-4	Validar y corregir Drag & Drop táctil (D2-02)	🟡	4h	Medio	Frontend
4	Implementar PWA con soporte offline (D1-03)	🟡	3 días	Medio	Frontend
Backlog	Activar analytics de comportamiento (D5-01)	🟡	1 día	Medio	Full Stack
Backlog	Documentar plan de contingencia por vendor lock-in (D1-05)	🟢	2h	Bajo	CTO / Arquitecto
Backlog	Clarificar estado del módulo Bitácora (D4-04)	🟢	4h	Bajo	Product
6. VISIÓN A 12 MESES
Arquitectura Objetivo: Un sistema modular (src/features) con PWA instalable, preparado para un despliegue "Multi-Tenant" a otras gerencias.

Funcionalidades Estratégicas:

Motor de automatización basado en eventos (alertas, notificaciones push).

Hub de integración con Webhooks (ERP, calendarios).

Vistas de control C-Level con exportación masiva a PDF/Excel.

Posicionamiento Final: Consolidarse no como un clon de Trello/Asana, sino como el Sistema Operativo Central del Departamento de TI, destacando en la formalidad operativa (OTs con receptor) y la trazabilidad que las herramientas genéricas no ofrecen sin un alto costo de customización.

7. CHECKLIST TÉCNICO CONSOLIDADO (CRITERIOS DE ACEPTACIÓN)
🔴 Críticos (Bloquean Release)
D4-01: sgtd_eliminar_tarea_con_log funciona con tareas en estado atrasada.

D4-01: No existen tareas reprogramada con fecha vencida. La función SQL se ejecutó.

D1-01: Error intencional en frontend aparece en dashboard de Sentry en < 2 min.

D2-01: Checklist de QA manual ejecutado y con 0 ítems en estado "FAIL".

D4-01: El formulario de creación/edición de OT guarda un borrador en servidor y sobrevive a un refresco (F5).

🟠 Altos (Siguientes Sprints)
D2-01: La ruta /planificacion tiene position: sticky en la columna de recursos.

D2-01: Las columnas con muchas tareas en /semana tienen overflow-y: auto y son usables.

D2-01: El Drawer de Notas se cierra con Escape y mantiene el foco atrapado.

D2-02: Búsqueda en código fuente confirma 0 coincidencias de #hex en estilos de componentes React.

D1-01: El pipeline CI/CD (lint → test → build) se ejecuta y bloquea merges si falla.

D1-04: npm run test:coverage genera reporte con métricas visibles > 70%.

D4-03: Un INSERT directo de OT con estado='completada' y receptor_nombre=NULL falla por constraint.

🟡 Medios (Backlog cercano)
D3-01: Lighthouse LCP < 2.5s en /semana con throttling "Slow 4G".

D3-01: Los assets PNG principales han sido convertidos a formato WebP.

D2-02: QA D5 (Drag & Drop táctil) verificado y marcado ✅ PASS en dispositivo real.

D1-02: El hook principal de Mi Semana reside en src/features/semana y no supera las 150 líneas.