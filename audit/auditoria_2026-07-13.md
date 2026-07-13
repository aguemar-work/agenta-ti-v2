# Auditoría exhaustiva — Materen SGTD (agenda-ti_v3)

**Fecha:** 2026-07-13
**Alcance:** Frontend (`web/`), base de datos y RLS (InsForge, proyecto `Project_AGUEMAR`), CI, higiene de repositorio.
**Metodología:** verificación en vivo, no solo lectura de código — CLI de InsForge contra el proyecto real (`db query`, `db policies`, `diagnose db`), `npm run lint`/`build`/`test`/`test:coverage` ejecutados, inspección de `git log`/`git status`, y lectura directa de los dumps SQL sueltos en la raíz. No se repiten aquí hallazgos previos sin volver a comprobarlos: cada ítem indica cómo se verificó.
**Auditorías previas relevantes:** `audit/audit_2026-04-22.md`, `web/auditorias/auditoria_08062026.md`, `web/auditorias/deuda_post_auditoria.md`, `web/auditorias/deuda_lint_2026-06-08.md`.

---

## Resumen ejecutivo

El sistema está en mejor estado de higiene de código que hace un mes (lint, build y tests limpios), pero esta auditoría encontró **tres hallazgos críticos no documentados antes**, todos relacionados con aislamiento de datos y exposición de PII:

1. Una tabla pública sin RLS con permisos de escritura para usuarios anónimos.
2. Una política de acceso legacy que rompe el aislamiento multi-organización para el rol "jefe" sobre la tabla de usuarios.
3. Un volcado completo de la base de datos con PII real de usuarios, sentado sin control en la raíz del repositorio y sin protección en `.gitignore`.

Ninguno de estos tres estaba en las auditorías previas — son regresiones o deuda nueva introducida después de junio. Se detalla evidencia y remediación de cada uno abajo.

---

## Hallazgos — Crítico

### C1. ✅ Resuelto 2026-07-13 — RLS deshabilitado en `public.modulos`, con escritura abierta a `anon`

**Evidencia:**
```sql
-- pg_class.relrowsecurity = false solo para esta tabla, de 22 tablas públicas
SELECT relname, relrowsecurity FROM pg_class ... WHERE nspname='public' AND relkind='r';
-- modulos | false   (las otras 21 tablas: true)

-- Grants sobre modulos:
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='modulos';
-- anon           | INSERT, SELECT, UPDATE, DELETE
-- authenticated  | INSERT, SELECT, UPDATE, DELETE
```

Es la única de 22 tablas del esquema `public` sin Row Level Security habilitado. Como PostgREST expone las tablas según los grants de rol y no hay RLS que filtre filas, **cualquier request no autenticado** (`anon`) puede leer, insertar, modificar o borrar filas de `modulos` directamente vía la API REST del backend. Hoy la tabla tiene una sola fila (catálogo `credenciales`), pero es el catálogo que determina qué módulos existen para `workspace_modulo` — su corrupción o borrado afecta a todos los workspaces.

**Por qué es crítico:** es una brecha de integridad explotable sin autenticación, no una hipótesis. Rompe el patrón "aislamiento en PostgreSQL + RLS" que el propio README declara como garantía de seguridad del sistema.

**Remediación:** aplicada vía `db/migrations/060_fix_modulos_rls.sql` contra el proyecto InsForge real. Verificado tras aplicar: `relrowsecurity=true`, grants de `anon`/`authenticated` reducidos a `SELECT`, y la lectura del catálogo sigue funcionando.

---

### C2. ✅ Resuelto 2026-07-13 — Política RLS legacy sin scope de organización permite a cualquier "jefe" ver y editar usuarios de otras organizaciones

**Evidencia:**
```sql
-- Políticas activas sobre usuario (rol authenticated):
usuario_select_self_or_jefe  | SELECT | (id = auth.uid()) OR auth_es_jefe()
usuario_update_self_or_jefe  | UPDATE | (id = auth.uid()) OR auth_es_jefe()

-- Definición de auth_es_jefe():
SELECT EXISTS (SELECT 1 FROM public.usuario u
               WHERE u.id = auth.uid() AND u.rol = 'jefe' AND u.activo = true);
-- Sin ningún filtro por organización ni workspace.
```

En paralelo existe `sgtd_jefe_usuario_all`, que sí valida correctamente pertenencia vía `workspace_member` (`wm.workspace_id = sgtd_workspace_id() AND wm.usuario_id = usuario.id`). El problema es que en PostgreSQL **las políticas permisivas se combinan con OR**: basta que exista una política amplia para que anule el efecto de las políticas correctamente scoped. Resultado verificado por definición de función y catálogo de políticas: un usuario con `rol='jefe'` en la Organización A puede hacer `SELECT` y `UPDATE` sobre **cualquier fila de `usuario`**, incluyendo perfiles (PII: nombre, email, preferencias) de usuarios de la Organización B, C, etc.

**Por qué es crítico:** rompe exactamente el modelo de aislamiento multi-tenant que las migraciones 043–050 (V5, multi-organización) se propusieron construir. Es una fuga de PII entre organizaciones-cliente distintas, más una vía de modificación no autorizada de perfiles ajenos.

**Hipótesis de causa:** `usuario_select_self_or_jefe`/`usuario_update_self_or_jefe` parecen residuos de la era pre-V5 (single-org), donde "jefe" implicaba jefe de la única organización. No se retiraron al introducir multi-organización.

**Remediación:** aplicada vía `db/migrations/061_fix_usuario_jefe_scope.sql` — se eliminaron ambas políticas legacy. Verificado tras aplicar (`pg_policies`): el auto-acceso sigue cubierto por `sgtd_miembro_usuario_select`/`_select_propio`/`_update`/`_update_propio`, y el acceso del jefe sigue cubierto, correctamente scoped por workspace, por `sgtd_jefe_usuario_all`. Ningún caso legítimo perdió acceso.

---

### C3. ✅ Resuelto 2026-07-13 — Volcado completo de la base de datos con PII real, sin protección en `.gitignore`

**Evidencia:**
```
$ git status
?? backup_completo.sql   (946 KB, "Include Data: true", row limit 1000/tabla)
?? schema_real.sql        (142 KB, solo esquema)
?? db/migrations.rar       (161 KB)

$ grep -coE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' backup_completo.sql
8   # 8 direcciones de correo reales distintas encontradas (redactadas de este informe a propósito)

$ cat .gitignore   # ninguna regla cubre *.sql, *.rar ni backup_*
```

`backup_completo.sql` es un export real de InsForge con datos de fila (incluye `usuario`, `organizacion`, `workspace_member`, etc.) y contiene direcciones de correo reales de personas, no datos de prueba. Está **untracked** (no committeado aún) pero sentado en el working tree de un repositorio que sí tiene remoto y colaboradores, sin ninguna regla en `.gitignore` que impida que un `git add -A`/`git add .` lo suba al historial de forma permanente e irreversible.

**Por qué es crítico:** es exposición de PII de usuarios reales en tránsito hacia un repositorio compartido, evitable con una sola línea de configuración. A diferencia de C1/C2 (que requieren cambios de esquema), este es el hallazgo más barato de cerrar y el que más urge cerrar ya, porque el riesgo se materializa con una acción tan común como `git add .`.

**Nota positiva verificada:** ningún `.env` ni `.insforge/project.json` (que sí contiene una API key activa) fue comprometido en el historial de git — están correctamente ignorados desde el inicio del proyecto. El problema es específicamente estos tres archivos nuevos, no un patrón general.

**Remediación:** agregadas reglas a `.gitignore` raíz (`/backup_*.sql`, `/schema_real*.sql`, `*.rar`) — verificado con `git status` que los 4 archivos (`backup_completo.sql`, `schema_real.sql`, `db/migrations.rar`, `db.rar`) ya no aparecen como untracked. **Pendiente (acción manual del equipo, no ejecutada por no ser reversible):** decidir si mover los archivos fuera del repo o borrarlos localmente, y si alguno llegó a compartirse fuera del entorno local, tratar los correos expuestos como PII divulgada según `web/CONTEXT/PRIVACIDAD-LEY29733.md`.

---

## Hallazgos — Alto

### A1. ✅ Resuelto 2026-07-13 — CSP con `script-src 'unsafe-inline'` en producción

**Evidencia (antes del fix):** `web/vercel.json` tenía `"script-src 'self' 'unsafe-inline'; ..."`. Mismo hallazgo que `AUDIT-018` (auditoría de junio), registrado entonces como "diferido, requiere nonce/hash en build Vite" — siguió sin remediar 5+ semanas.

**Causa raíz real (no nonce/hash — más simple):** `web/index.html` tenía exactamente dos piezas de script inline en todo el HTML servido: (1) un `<script>` de anti-flash de tema (aplica `.dark` antes del primer render), y (2) un atributo `onload="this.media='all'"` en el `<link>` de Google Fonts (truco `media="print"` para carga no bloqueante). Ninguna otra parte del HTML —React no emite handlers inline en el DOM— dependía de `'unsafe-inline'`.

**Remediación:** en vez de generar nonces/hashes por build (complejidad de `'unsafe-hashes'` para el atributo `onload`, y de infraestructura para nonces por request en un sitio estático), se externalizaron ambos:
- Nuevo `web/public/theme-init.js` (copiado tal cual al build por Vite, sin bundlear) con la misma lógica de anti-flash + swap de fuente, ahora usando `addEventListener('load', ...)` en vez del atributo `onload`.
- `web/index.html`: `<script src="/theme-init.js"></script>` (script clásico externo, sigue siendo bloqueante como el inline original — misma garantía anti-flash) reemplaza al `<script>` inline; el `<link>` de fuentes pierde el `onload` y gana `id="gfonts-link"`.
- `web/vercel.json`: `script-src 'self' 'unsafe-inline'` → `script-src 'self'`.

Verificado: `npm run build` copia `theme-init.js` sin procesar a `dist/`; `vite preview` sirve el HTML sin script inline ni `onload` y `theme-init.js` responde 200; lint (3 errores preexistentes, sin relación) y test suite (207/207) sin regresiones.

### A2. Cobertura de tests real: 9.21% statements — las capas de lógica de negocio están casi sin probar

**Evidencia (ejecución real de `npm run test:coverage`):**
```
Statements   : 9.21% ( 313/3395 )
Branches     : 10.54% ( 212/2011 )
Functions    : 8.21% ( 68/828 )
Lines        : 9.52% ( 270/2834 )

Por capa:
  api/      3.36%
  hooks/    1.99%
  lib/     38.13%
```
207 tests pasan (`22 archivos`), pero están concentrados casi enteramente en `lib/`. El patrón de arquitectura obligatorio del proyecto es `Page → useXxxPage → api/*.ts → InsForge SDK` — es decir, la capa donde vive la lógica de negocio y las llamadas al backend (`api/`, `hooks/`) es precisamente la que tiene menos del 4% de cobertura. Un cambio que rompa una validación de negocio o un mapeo de datos hacia InsForge tiene alta probabilidad de no ser detectado por la suite actual.

**Remediación:** priorizar tests de integración sobre `api/*.ts` y los hooks `useXxxPage` (con MSW, que ya está en el proyecto) antes de seguir sumando cobertura incremental en `lib/`. Considerar fijar un umbral mínimo en CI para `api/` y `hooks/` específicamente (ver también AUDIT-043 diferido).

**🔄 En progreso (backlog abierto, no cerrado) — avance 2026-07-13:** se agregaron 3 archivos de test nuevos en `src/api/__tests__/`:
- `semana.api.test.ts` (23 tests) — `api/semana.ts`, datos de Mi Semana (índice de la app): validación de justificación ≥10 caracteres al cancelar/eliminar/reprogramar, scoping personal-vs-organización de eventos, resolución de responsable (`resolveAsignadoA`), notificación realtime a jefes al completar tarea, orden por prioridad.
- `workspace.api.test.ts` (15 tests) — `api/workspace.ts`, resolución de organización/workspace accesible (V5 multi-tenant): fallback membresía→dueño de plataforma→`[]` en `getWorkspacesAccesiblesDeOrg`, filtrado defensivo de workspaces de otra organización o inactivos, y las dos formas en que PostgREST puede embeber el workspace relacionado (`workspace` vs objeto anidado en `workspace_id`).
- `invitacion.api.test.ts` (10 tests) — `api/invitacion.ts`, flujo de invitaciones: normalización de email antes de invocar la edge function `invite-user`, y que una respuesta de RPC/edge function con forma inesperada lance error explícito en vez de devolver datos corruptos silenciosamente.

- `plataforma.api.test.ts` (21 tests) — `api/plataforma.ts`, operaciones de dueño de plataforma (alto privilegio: eliminar usuarios, desactivar organizaciones, activar módulos). Cubre el dedupe por sesión de `fetchEsPlataformaOwnerCached` vía TanStack Query (incluyendo que cambiar de usuario invalida el cache anterior, para no arrastrar el resultado de otro usuario), la normalización de `orgs` cuando la RPC la devuelve como string JSON en vez de array, y que respuestas corruptas de RPC/edge function fallen explícito.

- `ordenTrabajo.api.test.ts` (15 tests) — `api/ordenTrabajo.ts`, flujo de Órdenes de Trabajo (`borrador→pendiente→aprobada→completada`). Documenta y verifica una regla no obvia: `actualizarOrdenTrabajo` preserva el estado `pendiente` al editar, pero **cualquier otro estado actual (incluida `aprobada`) cae silenciosamente a `borrador`** — comportamiento actual capturado en un test explícito, no una suposición. También cubre el dedupe de "última OT por tarea" en `getOrdenesPorTareaIds`, el patrón RPC+re-fetch de `enviarOTAlJefe` (con propagación de error en cualquiera de los dos pasos), y el recorte/normalización de campos de texto antes de enviarlos a los RPCs.

- `usuarios.api.test.ts`, `metricas.api.test.ts`, `sla.api.test.ts`, `organizacion.api.test.ts`, `areas.api.test.ts`, `clientes.api.test.ts`, `proyectos.api.test.ts`, `objetivos.api.test.ts` (8 archivos, ~50 tests) — catálogos CRUD (áreas/clientes/proyectos, mismo patrón de soft-delete + scoping por workspace), selectores de usuario, conteo de OTs por estado (métricas), resumen SLA con fallback ante respuesta corrupta, y `organizacion.ts` — la pieza más riesgosa del lote: `cambiarAOrganizacion` orquesta 3 llamadas a `workspace.ts` y debe degradar con gracia a `modulos=[]` si `getModulosDelWorkspace` falla, sin bloquear el cambio de organización por un fallo secundario (cubierto con un test explícito).

- `objetivosMetricas.api.test.ts`, `planificacion.api.test.ts`, `audit.api.test.ts`, `hoyColumnas.api.test.ts` (4 archivos, ~34 tests) — cierran la capa `api/` por completo. `objetivosMetricas.ts` es el módulo con más lógica de cómputo del proyecto (buckets por estado efectivo, agrupación semanal, comparativa por miembro) y el de mayor riesgo de bug silencioso: un error de categorización no lanza excepción, solo produce un número equivocado en un dashboard — se verificaron los buckets, la separación de incidencias del total, y que tareas de usuarios ya inactivos se descarten sin romper la comparativa. `planificacion.ts`: `fechaLunesDesdeSemanaIso` (algoritmo de búsqueda) se verificó con round-trip contra `semanaIsoDesdeFecha` para varias semanas incluyendo un año con 53 semanas ISO. `audit.ts`: el filtro defensivo de longitud de justificación en `getJustificacionesPendientesJefe` (duplica una regla ya aplicada en servidor) se probó explícitamente con justificaciones cortas/vacías.

**✅ Capa `api/` completa — las 21 unidades de test ahora cubren los 21 archivos de `api/*.ts`.** Resultado acumulado hasta ese punto: `api/` 3.36% → 70.48% statements; global 9.21% → 27.45%.

**Continuación en `hooks/` (35 archivos, 0% al iniciar):** primer lote de 8 hooks "puros" (sin `Page`, menor costo de setup): `useDraftForm`, `useMediaQuery`, `useIsMobile`, `useTheme`, `useSwipeDiaSemana`, `useSwipeOTRow`, `useWorkspaceId`, `useEsPlataformaOwner`.

**Hallazgo de proceso durante esta ronda (no es un bug de producción, pero vale la pena dejarlo registrado):** el primer intento de `useDraftForm.test.ts` pasaba `initialValues` como un objeto literal inline (`{ titulo: '' }`) directamente en cada `renderHook(() => useDraftForm('k1', { titulo: '' }))`. Como `initialValues` está en el array de dependencias de un `useEffect` interno del hook, un objeto recreado en cada render dispara un loop infinito de renders (cada commit crea un objeto con nueva identidad → dispara el efecto → vuelve a `setState` → nuevo render → nuevo objeting → …), que en la práctica se manifestó como un **crash por out-of-memory del proceso de test** (confirmado con `node --stack-trace`: heap de 4GB agotado) al correr ese archivo junto con otros. Se verificó que **no es un bug de producción**: los 5 call sites reales (`ModalNuevaTarea.tsx`, `ModalMiSemana.tsx`, `ModalDetalleTareaSemana.tsx`, `useObjetivosPage.ts` ×2) memoizan `initialValues` con `useMemo` correctamente. El fix fue en el test: usar una constante estable en vez del literal inline. Se deja anotado porque es el mismo patrón de riesgo (objeto no memoizado en deps de efecto) que sería un bug real de producción si algún componente nuevo llamara a `useDraftForm` sin memoizar.

Resultado tras ese lote: `hooks/` 0% → 9.46% statements; global 27.45% → 31.54%.

**Segundo lote (10 hooks con TanStack Query, mayor costo de setup pero aún no `Page`):** `useCrearOrganizacion`, `useOrgsDesactivadas`, `useModulosOrg`, `useUsuarios`, `useResumenSlaJefe`, `useOTTiposTrabajo`, `useOTAcciones`, `useTareas`, `usePageAnalytics`, `useSlaDigestToast`.

**🐛 Bug real encontrado (de producción, no de test) — `useOTTiposTrabajo.ts`:** la actualización optimista de `mutToggleTipo` (activar/desactivar un tipo de trabajo de OT) escribe y lee la caché de TanStack Query con la key `[Q_TIPOS_OT]` (sin el segmento de workspace), pero la query real que alimenta la UI está registrada como `[Q_TIPOS_OT, workspaceId]` (`useOrdenesTrabajoQueries.ts`). Como resultado, la actualización optimista nunca toca la entrada de caché que la UI realmente lee — el toggle **no se refleja instantáneamente**, y el usuario solo ve el cambio tras el `onSettled` (que sí invalida con la key correcta y refetchea). No hay corrupción de datos ni fallo funcional final, solo pérdida del feedback optimista prometido por el código. Verificado con un test explícito (`useOTTiposTrabajo.test.ts`) que confirma que la key con workspace queda intacta tras la mutación. **No se corrigió** — es un cambio de código de producción fuera del alcance de "agregar tests", queda para que el equipo lo priorice.

Resultado tras ese lote: `hooks/` 9.46% → 18.45% statements; global 31.54% → 36.73%.

**Tercer lote (8 hooks, incluye el más crítico del arranque de la app):** `useMiSemanaCatalogos`, `useMetricasOT`, `useUsuariosPlataforma`, `useInvitacionesPendientesPage`, `useWorkspaceBootstrap`, `useSemanaModales`, `useSemanaNotasIncidencias`, `useRealtimeNotificaciones`.

`useWorkspaceBootstrap.ts` orquesta la carga de organización/workspace tras el login — si esta lógica falla, el usuario queda sin acceso a la app aunque el login haya funcionado. Se cubrieron las ramas principales del árbol de decisión: dueño de plataforma sin orgs → modo panel; sin orgs ni ser dueño con/sin invitaciones pendientes → `necesitaInvitaciones` o error explícito; org+workspace únicos → aplica contexto automáticamente; múltiples accesibles → pide selector; ya inicializado → no vuelve a correr nada.

**🐛 Segundo bug real encontrado — `useRealtimeNotificaciones.ts`:** el parámetro `prefs` tiene un valor por defecto `= getDefaultNotificationPrefs()`. `AppShell.tsx` lo llama como `useRealtimeNotificaciones(notifPrefs ?? undefined)`, y `notifPrefs` arranca en `null` hasta que un `useEffect` las carga de `localStorage` tras resolverse el usuario. Mientras `notifPrefs` es `null`, cada render evalúa el parámetro por defecto de nuevo, creando un objeto con **identidad distinta** en cada render; como `prefs` está en el array de dependencias del `useEffect` de conexión realtime, esto dispara cleanup+reconexión de más (verificado con un test explícito: `connect()` se llama más de una vez). No es un loop infinito — se autolimita porque `setConectado(true)` no cambia de valor tras la segunda vuelta — pero sí duplica conexiones/suscripciones/desconexiones de forma innecesaria durante la ventana de arranque. **No se corrigió** — mismo criterio que el bug de `useOTTiposTrabajo.ts`: cambio de producción fuera de alcance de esta tarea, documentado para que el equipo lo priorice (fix natural: memoizar `notifPrefs` con `useMemo` o inicializarlo con `getDefaultNotificationPrefs()` en vez de `null` en `AppShell.tsx`).

Resultado tras ese lote: `hooks/` 18.45% → 34.1% statements; global 36.73% → 45.3%.

**Cuarto lote (5 hooks `Page` de catálogos + selector de workspace):** `useObjetivosMetricas` (hook, wrappers de KPIs), `useAreasPage`, `useClientesPage`, `useProyectosPage`, `useWorkspaceSelectorPage`. Los tres primeros comparten patrón (form + hasChanges + crear/actualizar/desactivar); se verificó explícitamente que `submitForm` elige crear vs. actualizar según `editandoId`, y que un nombre vacío/solo-espacios no dispara ninguna llamada. `useWorkspaceSelectorPage` tiene un atajo de rendimiento (org única + workspaces ya en el store → no reconsulta el backend) verificado con un test dedicado.

Resultado acumulado: `hooks/` 34.1% → 45.77% statements; **global cruza el 50%: 45.3% → 51.69%**. Sigue habiendo ~10 archivos de `hooks/` en 0% (los hooks `Page` más grandes: objetivos, planificación, órdenes de trabajo, panel, métricas, Mi Semana) — este hallazgo permanece abierto como backlog, no se marca resuelto.

### A3. ✅ Resuelto 2026-07-13 — Reporte de cobertura trackeado en git

**Evidencia:**
```
$ git ls-files web/coverage | wc -l
56
```
`web/coverage/lcov-report/*.html` y `web/coverage/lcov.info` están committeados. Es un artefacto generado que cambia en cada corrida de tests — no aporta valor versionado y genera ruido/diffs innecesarios en cada commit. `web/.gitignore` no tiene una regla `coverage/`.

**Remediación:** `git rm -r --cached web/coverage` + `coverage` agregado a `web/.gitignore`. Pendiente: commitear el borrado (`git status` lo muestra como staged deletion).

---

## Hallazgos — Medio

### M1. ✅ Resuelto 2026-07-13 — Migración `040` duplicada

`db/migrations/040_rebind_funciones_vivos.sql` y `040_reduccion_enums_y_limpieza.sql` coexistían. Ya estaba anotado como pendiente en el resumen de sesión de junio ("borrar del repo el duplicado `040_rebind_funciones_vivos.sql`") — siguió presente 5+ semanas.

**Verificación antes de borrar:** `040_rebind_funciones_vivos.sql` empieza con "Fragmento de la 040 — NO ejecutar solo" y su contenido (7 RPCs) está embebido palabra por palabra en el paso §5 de `040_reduccion_enums_y_limpieza.sql`, que es la migración real (`BEGIN...COMMIT` autocontenido, incluye guard, enum surgery, rebind de RPCs, índices y vista). El fragmento era material de trabajo, no una migración aplicable por sí sola.

**Remediación:** archivo eliminado; se actualizó el único comentario de rollback que lo referenciaba (`046_workspace_id_rpcs_catalogos`) para apuntar a `040_reduccion_enums_y_limpieza.sql §5` en su lugar.

### M2. ✅ Resuelto 2026-07-13 (parcial) — `db.rar` trackeado en el historial de git

`db.rar` (114 KB, commit `cf2dc0e`) contenía únicamente los `.sql` de `db/migrations/002`–`009` en formato comprimido — verificado con `7z l db.rar`, sin datos, solo esquema. No exponía PII, pero duplicaba contenido que ya vive sin comprimir en `db/migrations/`, sin aportar valor.

**Remediación:** `git rm db.rar` — ya no se rastrea hacia adelante. **Sigue en el historial** (commit `cf2dc0e` y siguientes) porque reescribir el historial (`git filter-repo`/BFG) es una operación destructiva que reescribe hashes de commit y afecta a cualquier clon existente del repo; no se ejecuta sin que el equipo lo decida explícitamente. Impacto de dejarlo: bajo — el contenido es solo esquema, no PII.

### M3. Deuda diferida de auditorías previas, sin fecha de revisión

De `deuda_post_auditoria.md`, siguen abiertos sin cambios verificables desde el repo:
- `AUDIT-020` — JWT del SDK en storage (mitigado por CSP, pero A1 acaba de mostrar que la CSP sigue débil).
- `AUDIT-021` — token de reset de contraseña en router state.
- `AUDIT-035` — rate limiting a nivel de aplicación (delegado a InsForge/WAF, sin verificación propia).
- `AUDIT-043` — sin umbral de cobertura en CI (agravado por A2: hoy no habría nada que lo detenga).

Estos no son hallazgos nuevos, pero se listan aquí para que queden en un único documento vigente con fecha de corte, en vez de dispersos entre dos archivos de deuda distintos.

---

## Verificado en buen estado

No todo es negativo — lo siguiente se comprobó activamente y está en orden:

- **Lint:** solo 3 errores (`npm run lint`) — bajó de los 25 documentados en `deuda_lint_2026-06-08.md`. Los 3 restantes: 2 por `setState` síncrono en `useEffect` (`ModalAsignarUsuario.tsx`, `ModalInvitarUsuario.tsx`) y 1 por triple-slash reference en `vite.config.ts`.
- **CI ya no usa `continue-on-error` en el step de lint** (`.github/workflows/ci.yml`) — contradice lo que registraba `deuda_post_auditoria.md`; es una mejora real no documentada aún.
- **`tsc -b` y `vite build` limpios**, sin errores de tipos ni de build.
- **Suite de tests: 207/207 verde** (22 archivos).
- **Sin patrones peligrosos de XSS** (`dangerouslySetInnerHTML`, `eval(`, `innerHTML =`, `document.write`) en `web/src` — búsqueda exhaustiva sin coincidencias.
- **Salud de base de datos** (InsForge `diagnose db`, en vivo contra producción): cache-hit ratio 100%, sin slow queries (>5s), sin bloat significativo, 17/60 conexiones activas, sin problemas de tamaño.
- **Ninguna política RLS con `USING (true)` o `WITH CHECK (true)`** fuera del rol de servicio `project_admin` — se verificó explícitamente por SQL contra `pg_policies`, sin resultados.
- **Ningún secreto comprometido en git:** `.env`, `.env.*` y `.insforge/project.json` (que sí contiene una API key activa) nunca se han committeado — correctamente cubiertos por `.gitignore` desde el inicio.

---

## Recomendaciones priorizadas

| # | Acción | Severidad | Esfuerzo | Estado |
|---|--------|-----------|----------|--------|
| 1 | Habilitar RLS en `modulos` + revocar escritura de `anon`/`authenticated` | Crítico | Bajo | ✅ Resuelto 2026-07-13 (`060_fix_modulos_rls.sql`) |
| 2 | Eliminar/re-scopear políticas legacy `usuario_select_self_or_jefe` y `usuario_update_self_or_jefe` | Crítico | Medio | ✅ Resuelto 2026-07-13 (`061_fix_usuario_jefe_scope.sql`) |
| 3 | Sacar los 3 dumps SQL del repo + agregar reglas a `.gitignore` | Crítico | Bajo | ✅ `.gitignore` resuelto — pendiente decidir si mover/borrar los archivos localmente |
| 4 | Quitar `'unsafe-inline'` de la CSP (nonce/hash en build) | Alto | Medio | ✅ Resuelto 2026-07-13 (externalización, no nonce/hash) |
| 5 | Tests de integración sobre `api/` y `hooks/` | Alto | Alto (backlog continuo) | Pendiente |
| 6 | `git rm -r --cached web/coverage` + `.gitignore` | Alto | Bajo | ✅ Resuelto 2026-07-13 (falta commitear) |
| 7 | Borrar migración `040` duplicada (confirmar cuál es la vigente) | Medio | Bajo | ✅ Resuelto 2026-07-13 |
| 8 | Retirar `db.rar` del working tree | Medio | Bajo | ✅ Resuelto 2026-07-13 (queda en historial, ver M2) |
| 9 | Fijar fecha de revisión para deuda diferida (`AUDIT-020/021/035/043`) con Legal/DevOps | Medio | Bajo (es proceso, no código) | Pendiente |

**Los ítems 1, 2 y 6 quedaron resueltos y verificados en vivo el 2026-07-13. El ítem 3 está mitigado (ya no hay riesgo de commit accidental) pero requiere una decisión del equipo sobre qué hacer con los archivos en sí — ver detalle en C3.**
