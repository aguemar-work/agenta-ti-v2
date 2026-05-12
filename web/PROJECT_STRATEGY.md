# Guía estratégica del proyecto — Nexora (SGTD · Agenda TI v3)

**Audiencia:** desarrolladores, diseñadores, product owners y liderazgo técnico.  
**Alcance:** monorepo `agenda-ti_v3` con foco en la SPA `web/` y su relación con datos InsForge / Postgres.  
**Documentos complementarios:** `README.md`, `CONTEXT/CONTEXT_2026-05-11.md`, `CONTEXT/auditoria_consistencia_2026-05-12.md`, reglas en `.cursor/rules/`.

---

## 1. Estado actual del sistema

### 1.1 Descripción general

**Nexora** es la interfaz web del **Sistema de Gestión de Tareas Departamental (SGTD)**: apoya la **planificación semanal**, la **ejecución** con estados de tarea alineados a base de datos, **objetivos** estratégicos con tareas vinculadas, **órdenes de trabajo (OT)** con flujo de aprobación, **eventos** en la agenda, **métricas** para el jefe y una vista de **planificación** de solo lectura para supervisión.

Los datos viven en **InsForge** (Postgres, políticas **RLS**). El cliente usa **`@insforge/sdk`** + **TanStack Query**; la sesión se gestiona con refresh automático e interceptor de `401` (sin exponer errores de token al usuario).

### 1.2 Evolución (visión resumida)

| Fase | Qué representa |
|------|----------------|
| **Versiones tempranas / CONTEXT 2026-04-23** | Rutas y vistas dedicadas como **Hoy**, **Tablero**, **Bitácora** con mayor fragmentación de navegación. |
| **V4 (estado vigente)** | Consolidación en **Mi semana** como eje del miembro, **Planificación** y **Métricas** para jefe; eliminación del router dedicado a `/tablero`, `/bitacora` y vista `/hoy` como primera clase. Convivencia de patrones `pages/` + `hooks/` + `api/`. |
| **Refinamiento UX/UI reciente** | Shell lateral **220px** con agrupación Trabajo/Gestión, iconografía **Tabler**, marca morada para navegación activa y formularios modales unificados; tarjetas de semana rediseñadas; **notas** en **drawer** en Mi semana; **OT** con borrador local y un solo envío al jefe; corrección del **scroll** del área principal (`mc-app-root` con altura de viewport explícita). |

La evolución muestra un paso de **muchas vistas** a **menos rutas más densas**, con mayor carga en **Mi semana** y en flujos modales.

### 1.3 Módulos implementados (rutas)

| Módulo | Ruta | Roles |
|--------|------|--------|
| Autenticación y recuperación | `/login`, `/forgot-password`, `/verify-reset-code`, `/reset-password` | Público |
| **Mi semana** | `/semana` | Jefe, Miembro |
| **Objetivos** | `/objetivos` | Jefe, Miembro |
| **Órdenes de trabajo** | `/ordenes-trabajo` | Jefe, Miembro |
| **Planificación** | `/planificacion` | Solo jefe |
| **Métricas** | `/metricas` | Solo jefe |

Redirección: `/` → `/semana`.

### 1.4 Arquitectura funcional

- **Capa de presentación:** React 19, componentes en `src/components/` (layout, ui, semana, tareas, ot, routing), páginas en `src/pages/` (lazy load en `App.tsx`).
- **Orquestación:** hooks por vista (`useMiSemanaPage`, `usePlanificacionPage`, `useOrdenesTrabajoPage`, etc.) encapsulan queries, mutaciones y estado de UI.
- **Datos:** `src/api/*` habla con InsForge; validación y contratos con **Zod** en `src/lib/schemas.ts` donde aplica.
- **Estado transversal:** `authStore`, `vistaStore`; realtime opcional vía hooks y publicación de eventos.
- **Estilos:** sistema **Meta Canvas** (`mc-*`) + tokens semánticos (`design-tokens.css` / `ds-*` donde se introdujo); Tailwind para utilidades.
- **Reglas de negocio:** documentadas en `.cursor/rules/sgtd-business-rules.mdc` y alineadas con el esquema canónico (p. ej. imprevistos, log con justificación, métricas ponderadas); la **autoridad** en permisos es **RLS + rol en tabla `usuario`**.

### 1.5 Fortalezas actuales

- **Stack moderno y mantenible:** TypeScript estricto, Vite, Query con invalidación clara.
- **Seguridad de sesión conscientemente diseñada:** interceptor, refresh, sin mensajes crudos de JWT en UI.
- **RBAC explícito** en UI y documentado para no confundirse con el JWT.
- **DnD** en Mi semana con colisiones por día.
- **Design system parcial pero real:** tokens, modales portalados, botones, formularios, límites de error por sección (`SectionErrorBoundary`).
- **Documentación de contexto** en `CONTEXT/` y auditoría de consistencia útil para priorizar trabajo UX.
- **Tests unitarios** puntuales (hooks, lib de tablero, fechas, permisos, schemas).

### 1.6 Debilidades detectadas

- **Duplicación de patrones visuales:** KPIs, cabeceras tipo tabla, empty states y colores hex todavía **no unificados** en todas las páginas (ver auditoría `auditoria_consistencia_2026-05-12.md`).
- **Convivencia `pages/hooks/api` vs `features/`:** riesgo de crecimiento orgánico sin límites de módulo.
- **Deuda en Planificación / tablas anchas:** primera columna no sticky; posible fatiga en pantallas medianas.
- **Grilla Mi semana:** riesgo de **overflow** en columnas muy cargadas si no se revisa `SemanaDiaDrop` / alturas mínimas frente a muchas tarjetas.
- **OT:** tras simplificar a un solo botón de envío, el flujo **“guardar borrador en servidor”** (`enviar: false`) dejó de estar en UI; solo queda borrador **local** — validar con negocio.
- **Dos familias de iconos** (Lucide + Tabler): coherencia aceptable si los roles están claros; coste de bundle a vigilar.
- **Drawer de notas:** mejora el layout; falta pulir **accesibilidad** (Escape, trap de foco) si se exige paridad con modales.

---

## 2. Cambios realizados hasta ahora (línea de tiempo técnica / UX)

### 2.1 Diseño y marca

- Tokens de **marca morada** (`--mc-brand-violet`, soft) para navegación activa y CTAs de formulario unificado.
- **`design-tokens.css`** (`--ds-*`) y componentes como **`StatusBadge`** donde se alineó con estados.
- Tarjetas de **Mi semana** con radios, bordes y tipografía acordados; eventos tipo **reunión** con acento lateral morado.

### 2.2 Experiencia de usuario (UX/UI)

- **Sidebar:** labels siempre visibles, agrupación por contexto (Trabajo / Gestión), avatar en cabecera.
- **Mi semana:** cabecera de módulo dedicada, KPIs como **cards compactas**, día “hoy” con **indicador puntual**, **“+ Nueva tarea”** como acción secundaria (decisión de producto frente al patrón “un solo primary” de otras vistas).
- **Notas** retiradas del flujo principal → **drawer**.
- **Modales** (nueva tarea, ítem Mi semana, OT, nuevo objetivo): estructura homogénea (cuerpo con altura de control 36px, pie apilado, botón primario morado).

### 2.3 Refactorizaciones técnicas

- **`AppShell`:** configuración de navegación por grupos; integración Tabler en shell y bottom nav.
- **`useOrdenesTrabajoPage`:** persistencia local diferida del formulario de **nueva** OT; mutaciones de creación/edición orientadas a **enviar** al jefe.
- **`Modal`:** soporte de `bodyClassName` / `footerClassName` para composición consistente.
- **Layout / scroll:** `#root` como flex column; **`mc-app-root`** con altura explícita al viewport para restaurar **scroll en `mc-main`**.

### 2.4 Reestructuración de componentes

- Separación visual clara entre **`DraggableTareaSemana`** y **`EventoCard`** con clases dedicadas (`mc-semana-task-card`, `mc-evento-card*`).
- Piezas de UI reutilizables (`EmptyState`, `KpiCard`, `PageHeader`, `FilterBar`) — en progreso de adopción uniforme según auditoría.

### 2.5 Navegación

- Ancho fijo **220px**, sin rail colapsado; drawer “Más” en móvil conservado.

### 2.6 Consistencia visual

- Form tabs unificados (`mc-modal-form-tabs`), botón modal primario (`mc-btn-modal-primary`), footer de modal en columna (`mc-modal-footer--stack`).

---

## 3. Problemas identificados

### 3.1 Inconsistencias de diseño

- **Semántica de color:** uso histórico de **warning (amarillo)** para “incidencias” como registro neutral; conviene token **`--mc-state-incidencia-*`** alineado a **info** (auditoría V-02).
- **Hex en páginas** (Métricas, Objetivos, Planificación) en lugar de tokens de estado (V-03).
- **CTA primario:** Mi semana usa **secondary** para “+ Nueva tarea” mientras Objetivos/OT usan **primary** — decisión consciente post-rediseño, pero genera **inconsistencia cross-módulo**; documentar como regla de producto o unificar.
- **Cabeceras de tabla / listas:** mezcla de `<table>`, grid con estilos inline y Tailwind (V-04).
- **Empty states** y **KPIs** con varias implementaciones (V-05, V-06).

### 3.2 Deuda técnica

- Estilos **inline** extensos en `Objetivos.tsx` y partes de otras páginas.
- Componentes locales duplicados (`KpiCard` en Métricas vs componente UI).
- Falta de **`features/`** como frontera de módulo si el equipo quiere escalar equipos por dominio.

### 3.3 Escalabilidad

- **Hooks grandes** por vista: riesgo de dificultad de test y de onboarding; candidatos a subdividir por sub-hooks o capa de “servicios” de dominio solo en cliente.
- **InsForge / RLS:** cualquier nuevo campo o tabla debe pasar por **migraciones** y políticas; el cliente no debe adelantarse al esquema (`CONTEXT.md` / reglas).

### 3.4 Organización del código

- Patrón dominante **Page + useXxxPage + api** es claro pero puede **acoplarse** si no se extraen subcomponentes y tipos compartidos.
- Tests concentrados en `lib` y algunos hooks; cobertura de **páginas** limitada.

### 3.5 Rendimiento

- Bundle con **Tabler + Lucide + Sentry + Query** es razonable; conviene **monitorizar** y lazy-load agresivo ya aplicado en rutas.
- Listas largas sin virtualización: aceptable en departamentos pequeños; vigilar si el volumen de tareas crece.

### 3.6 Usabilidad

- Planificación con scroll horizontal **sin columna fija** de nombre (F-02 auditoría).
- Posible **recorte** de contenido en columnas del día si muchas tarjetas (F-01).
- Drawer de notas sin teclado completo aún.

---

## 4. Recomendaciones estratégicas

### 4.1 Prioridades de mejora (orden sugerido)

1. **Tokens y semántica de color** — eliminar hex sueltos; introducir tokens soft de estado e incidencia neutral.
2. **Componentes canónicos** — un `DataTable` / `mc-list-header` + filas; un solo **`KpiCard`** parametrizado usado en Mi semana, Planificación y Métricas; **`EmptyState`** con variantes.
3. **Accesibilidad** — drawer (Escape, foco), tablas con `scope` donde falte, contrastes en tokens morados.
4. **Planificación** — sticky primera columna; revisión de empty states.
5. **Producto OT** — decidir si se necesita de nuevo **persistencia server-side** de borrador o borrador auto en API.

### 4.2 Refactorización de módulos críticos

- **`useMiSemanaPage` / `MiSemana.tsx`:** extraer sub-vistas (header, KPI row, grid, drawer) a componentes puros para tests y legibilidad.
- **`Objetivos.tsx`:** migrar estilos inline a clases y tokens; hover vía CSS.
- **`Metricas.tsx`:** misma línea + unificación de énfasis en KPIs (V-09).

### 4.3 Design system

- Ya existe base **`mc-*`** + **`design-tokens.css`**; siguiente paso es **obligar** nuevas pantallas a checklist de auditoría (sección “Checklist para nuevos módulos” en `auditoria_consistencia_2026-05-12.md`).
- Opcional: documento **`DESIGN-SYSTEM.md`** en raíz si el equipo lo mantiene fuera de Cursor rules.

### 4.4 Arquitectura

- Introducir gradualmente **`src/features/<modulo>/`** con `components`, `hooks`, `api` por feature **sin romper** imports existentes.
- Mantener **InsForge** como única fuente de verdad de datos; evitar duplicar enums en UI.

### 4.5 Seguridad

- Mantener **RLS** alineado con la matriz RBAC de `.cursor/rules/sgtd-rbac.mdc`.
- Revisar que ninguna acción destructiva omita **`log_accion`** + justificación en backend (regla de negocio).
- Secrets solo en entorno; nunca en repo.

### 4.6 Rendimiento

- Medir bundle post-cambios; si Tabler crece, limitar imports o tree-shake estricto.
- Considerar **virtualización** solo si métricas reales lo exigen.

### 4.7 Documentación adicional

- **Runbook de despliegue** (InsForge env, migraciones `db/migrations`).
- **Diagrama de entidades** simplificado (tarea, objetivo, OT, evento, usuario) enlazado al `CONTEXT`.
- **Glosario** de estados y tipos (una tabla generada desde `types/index.ts` + schema).

---

## 5. Roadmap sugerido

### 5.1 Corto plazo (1–3 semanas)

- Cerrar **Fase A–B** de la auditoría: tokens faltantes + componentes `KpiCard` / list header / empty state unificado donde más duela (Métricas, Objetivos).
- **Sticky** en Planificación + **overflow** explícito en columnas de Mi semana si se reproduce F-01.
- **Drawer notas:** Escape + manejo de foco.
- Revalidar con negocio el flujo **OT** (borrador local vs servidor).

### 5.2 Mediano plazo (1–2 meses)

- Migración incremental a **`features/`** por módulo (empezar por **semana** o **objetivos**).
- Tests de integración ligeros (RTL) en flujos: crear tarea, mover DnD, crear OT.
- Reducir inline styles en **Objetivos** y **Metricas**.
- Unificar **subtítulos** de `PageHeader` según reglas temporales vs contextuales (V-07).

### 5.3 Largo plazo (3+ meses)

- **Notificaciones** in-app persistentes y centro de notificaciones si el realtime crece.
- **Informes** exportables (PDF/CSV) desde Métricas / Planificación.
- **Multi-equipo / multi-área** si el modelo organizacional lo exige (namespacing en datos + RLS más fino).
- **App móvil** o PWA offline limitada solo si hay caso de uso de campo.

---

## 6. Visión futura del producto

### 6.1 Escalabilidad organizacional

El SGTD está pensado para un **equipo de área** con rol jefe y miembros. A escala multi-equipo, hace falta modelo de **tenant / área**, delegación de jefes y vistas agregadas sin mezclar datos — sobre todo a nivel de **InsForge** (schemas, RLS, índices).

### 6.2 Plataforma empresarial

Con **APIs estables**, **auditoría** completa (`log_accion`), **métricas ponderadas** y **OT**, el producto puede evolucionar hacia un **hub de ejecución** ligado a OKRs departamentales y a sistemas externos (ERP, tickets) mediante webhooks o sync bidireccional — siempre preservando una **única fuente de verdad** en Postgres.

### 6.3 Integración con nuevas áreas

Los mismos patrones (semana + objetivos + OT) son exportables a otras áreas de la empresa si se parametrizan **plantillas de objetivo**, **tipos de OT** y **calendarios laborales** (feriados, jornadas).

### 6.4 Profesionalización

- **SLAs** explícitos en UI para tareas atrasadas críticas.
- **Calidad de datos** (validaciones en servidor, jobs para estado `atrasada`).
- **Observabilidad** (Sentry + métricas de uso anónimas) para priorizar roadmap real.

### 6.5 Objetivo estratégico

Que Nexora sea percibida como **herramienta operativa diaria indispensable** (no solo “otra agenda”): planificación clara, ejecución medible, trazabilidad de decisiones y **confianza** en que lo que ve cada rol refleja exactamente lo que la política de datos permite.

---

*Última actualización alineada con el estado del código y documentación interna (2026). Revisar periódicamente tras releases mayores.*
